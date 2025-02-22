const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

// Ensure build directories exist
fs.ensureDirSync(path.join(__dirname, '../public'));
fs.ensureDirSync(path.join(__dirname, '../src/content'));
fs.ensureDirSync(path.join(__dirname, '../src/templates'));

// Read template
const template = fs.readFileSync(
  path.join(__dirname, '../src/templates/base.html'),
  'utf-8'
);

// Build pages
async function build() {
  // Copy static assets
  await fs.copy(
    path.join(__dirname, '../src/styles'),
    path.join(__dirname, '../public/styles')
  );
  
  // Create blog directory in public
  fs.ensureDirSync(path.join(__dirname, '../public/blog'));
  
  // Process markdown files
  const contentDir = path.join(__dirname, '../src/content');
  const blogDir = path.join(contentDir, 'blog');
  
  // Track blog posts for the index
  const blogPosts = [];
  
  // Process blog posts
  if (fs.existsSync(blogDir)) {
    const blogFiles = await fs.readdir(blogDir);
    
    for (const file of blogFiles) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(blogDir, file), 'utf-8');
        const { attributes, body } = frontMatter(content);
        const html = marked(body);
        
        blogPosts.push({
          title: attributes.title,
          date: attributes.date,
          description: attributes.description,
          url: `/blog/${file.replace('.md', '.html')}`
        });
        
        const finalHtml = template
          .replace('{{title}}', attributes.title || 'Blog Post')
          .replace('{{content}}', html);
        
        await fs.writeFile(
          path.join(__dirname, '../public/blog', file.replace('.md', '.html')),
          finalHtml
        );
      }
    }
  }
  
  // Sort blog posts by date
  blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Copy static index.html if it exists
  const indexPath = path.join(contentDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    await fs.copy(indexPath, path.join(__dirname, '../public/index.html'));
  }
  
  // Process regular markdown pages
  const files = await fs.readdir(contentDir);
  
  for (const file of files) {
    // Skip index.html as we handle it separately
    if (file === 'index.html') continue;
    
    if (file.endsWith('.md')) {
      const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
      const { attributes, body } = frontMatter(content);
      let html = marked(body);
      
      // If this is the blog index, inject the blog posts list
      if (file === 'blog.md') {
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