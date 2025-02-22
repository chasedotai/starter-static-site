const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

// Ensure build directories exist
fs.ensureDirSync(path.join(__dirname, '../public'));
fs.ensureDirSync(path.join(__dirname, '../public/rabbit-holes'));
fs.ensureDirSync(path.join(__dirname, '../src/content'));
fs.ensureDirSync(path.join(__dirname, '../src/content/rabbit-holes'));
fs.ensureDirSync(path.join(__dirname, '../src/content/attachments')); // For Obsidian attachments
fs.ensureDirSync(path.join(__dirname, '../src/templates'));

// Read template
const template = fs.readFileSync(
  path.join(__dirname, '../src/templates/base.html'),
  'utf-8'
);

// Convert Obsidian links to HTML links and handle attachments
function convertObsidianLinks(content) {
  // Convert [[page]] to regular links
  content = content.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
    if (p1.includes('|')) {
      const [link, text] = p1.split('|');
      return `[${text}](/${link}.html)`;
    }
    return `[${p1}](/${p1}.html)`;
  });

  // Convert ![[image.png]] to <img> tags
  content = content.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
    return `![${p1}](/attachments/${p1})`;
  });

  return content;
}

// Add this helper function at the top with the other functions
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
}

// Build pages
async function build() {
  // Copy static assets
  await fs.copy(
    path.join(__dirname, '../src/styles'),
    path.join(__dirname, '../public/styles')
  );
  
  // Copy attachments
  const attachmentsDir = path.join(__dirname, '../src/content/attachments');
  if (fs.existsSync(attachmentsDir)) {
    await fs.copy(
      attachmentsDir,
      path.join(__dirname, '../public/attachments')
    );
  }
  
  // Create blog directory in public
  fs.ensureDirSync(path.join(__dirname, '../public/rabbit-holes'));
  
  // Process markdown files
  const contentDir = path.join(__dirname, '../src/content');
  const blogDir = path.join(contentDir, 'rabbit-holes');
  
  // Track blog posts for the index
  const blogPosts = [];
  
  // Process blog posts
  if (fs.existsSync(blogDir)) {
    const blogFiles = await fs.readdir(blogDir);
    
    for (const file of blogFiles) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(blogDir, file), 'utf-8');
        const { attributes, body } = frontMatter(content);
        const processedBody = convertObsidianLinks(body);
        const html = marked(processedBody);
        
        // Create URL-friendly filename
        const safeFileName = slugify(file.replace('.md', '')) + '.html';
        
        blogPosts.push({
          title: attributes.title,
          date: attributes.date,
          description: attributes.description,
          url: `/rabbit-holes/${safeFileName}`
        });
        
        const finalHtml = template
          .replace('{{title}}', attributes.title || 'Blog Post')
          .replace('{{content}}', html);
        
        await fs.writeFile(
          path.join(__dirname, '../public/rabbit-holes', safeFileName),
          finalHtml
        );
      }
    }
  }
  
  // Sort blog posts by date
  blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Process regular markdown files
  const files = await fs.readdir(contentDir);
  for (const file of files) {
    if (file.endsWith('.md') && !file.startsWith('_')) {
      const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
      const { attributes, body } = frontMatter(content);
      const processedBody = convertObsidianLinks(body);
      let html = marked(processedBody);
      
      // If this is the blog index, inject the blog posts list
      if (file === 'rabbit-holes.md') {
        const postsHtml = blogPosts
          .map(post => `
            <article class="blog-post">
              <h2><a href="${post.url}">${post.title}</a></h2>
              <time datetime="${post.date}">${new Date(post.date).toLocaleDateString()}</time>
              <p>${post.description}</p>
            </article>
          `)
          .join('\n');
        html = html + postsHtml;
      }
      
      const finalHtml = template
        .replace('{{title}}', attributes.title || 'My Site')
        .replace('{{content}}', html);
      
      const outFile = file.replace('.md', '.html');
      await fs.writeFile(
        path.join(__dirname, '../public', outFile),
        finalHtml
      );
    }
  }
}

build().catch(console.error); 