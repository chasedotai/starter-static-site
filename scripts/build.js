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

// Read templates
const rootTemplate = fs.readFileSync(
  path.join(__dirname, '../src/templates/base.html'),
  'utf-8'
).replace(/href="\.\.\/"/g, 'href="./"')
 .replace(/href="\.\.\/styles/g, 'href="./styles')
 .replace(/href="\.\.\/rabbit-holes/g, 'href="./rabbit-holes');

const nestedTemplate = fs.readFileSync(
  path.join(__dirname, '../src/templates/base.html'),
  'utf-8'
);

// Convert Obsidian links to HTML links and handle attachments
function convertObsidianLinks(content, isNested = false) {
  const prefix = isNested ? '../' : './';
  
  // First convert ![[image.png]] to <img> tags - must come before regular links
  content = content.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
    console.log('Converting image:', p1);
    return `![${p1}](${prefix}attachments/${p1})`;
  });

  // Then convert [[page]] to regular links
  content = content.replace(/(?<!!)\[\[(.*?)\]\]/g, (match, p1) => {
    if (p1.includes('|')) {
      const [link, text] = p1.split('|');
      return `[${text}](${prefix}${link}.html)`;
    }
    return `[${p1}](${prefix}${p1}.html)`;
  });

  console.log('Processed content:', content);
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

// Update the extractInternalLinks function
function extractInternalLinks(content) {
  const links = new Set();
  const linkRegex = /\[\[(.*?)\]\]/g;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    // Skip if this is an image link (starts with !)
    if (content.charAt(match.index - 1) === '!') continue;
    
    const link = match[1].split('|')[0]; // Get the link part before any |
    links.add(link);
  }
  
  return Array.from(links);
}

// Add this function to create a placeholder page
function createPlaceholderContent(title) {
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  return `---
title: ${title}
date: ${today}
description: A future exploration
status: stub
---

# ${title}

This is a side path in this rabbit hole that I haven't gone down yet.
`;
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
        const processedBody = convertObsidianLinks(body, true);
        const html = marked(processedBody);
        
        // Create URL-friendly filename
        const safeFileName = slugify(file.replace('.md', '')) + '.html';
        
        blogPosts.push({
          title: attributes.title,
          date: attributes.date,
          description: attributes.description,
          url: `./rabbit-holes/${safeFileName}`,
          status: attributes.status || 'published'
        });
        
        const finalHtml = nestedTemplate
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
  
  // Collect all internal links
  const allInternalLinks = new Set();
  const existingFiles = new Set();
  
  // First pass: collect existing files and all internal links from main content
  const files = await fs.readdir(contentDir);
  for (const file of files) {
    if (file.endsWith('.md')) {
      existingFiles.add(path.join('rabbit-holes', file.replace('.md', '')));
      const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
      extractInternalLinks(content).forEach(link => allInternalLinks.add(link));
    }
  }

  // Also check rabbit-holes directory for links
  if (fs.existsSync(blogDir)) {
    const blogFiles = await fs.readdir(blogDir);
    for (const file of blogFiles) {
      if (file.endsWith('.md')) {
        existingFiles.add(path.join('rabbit-holes', file.replace('.md', '')));
        const content = await fs.readFile(path.join(blogDir, file), 'utf-8');
        extractInternalLinks(content).forEach(link => allInternalLinks.add(link));
      }
    }
  }

  // Create placeholder files for missing links
  for (const link of allInternalLinks) {
    const safePath = path.join(contentDir, 'rabbit-holes', `${link}.md`);
    // Ensure the rabbit-holes directory exists
    fs.ensureDirSync(path.join(contentDir, 'rabbit-holes'));
    
    if (!existingFiles.has(path.join('rabbit-holes', link))) {
      if (!fs.existsSync(safePath)) {
        await fs.writeFile(
          safePath,
          createPlaceholderContent(link)
        );
        console.log(`Created placeholder for: ${link} in rabbit-holes directory`);
      }
    }
  }
  
  // Process regular markdown files
  for (const file of files) {
    if (file.endsWith('.md') && !file.startsWith('_')) {
      const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
      const { attributes, body } = frontMatter(content);
      const processedBody = convertObsidianLinks(body, false);
      let html = marked(processedBody);
      
      // If this is the blog index, inject the blog posts list
      if (file === 'rabbit-holes.md') {
        const postsHtml = blogPosts
          .map(post => `
            <article class="blog-post ${post.status === 'stub' ? 'stub-post' : ''}">
              <h2>
                <a href="${post.url}">${post.title}</a>
                ${post.status === 'stub' ? '<span class="stub-indicator">Stub</span>' : ''}
              </h2>
              <time datetime="${post.date}">${new Date(post.date).toLocaleDateString()}</time>
              <p>${post.description}</p>
            </article>
          `)
          .join('\n');
        html = html + postsHtml;
      }
      
      const finalHtml = rootTemplate
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