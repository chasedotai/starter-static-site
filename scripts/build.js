const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

// Ensure build directories exist
fs.ensureDirSync(path.join(__dirname, '../public'));
fs.ensureDirSync(path.join(__dirname, '../src/content'));
fs.ensureDirSync(path.join(__dirname, '../src/content/attachments')); // For Obsidian attachments
fs.ensureDirSync(path.join(__dirname, '../src/templates'));

// Read template
const template = fs.readFileSync(
  path.join(__dirname, '../src/templates/base.html'),
  'utf-8'
);

// Convert Obsidian links to HTML links and handle attachments
function convertObsidianLinks(content) {
  // First convert ![[image.png]] to <img> tags - must come before regular links
  content = content.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
    console.log('Converting image:', p1);
    return `![${p1}](/starter-static-site/attachments/${p1})`;
  });

  // Then convert [[page]] to regular links
  content = content.replace(/(?<!!)\[\[(.*?)\]\]/g, (match, p1) => {
    if (p1.includes('|')) {
      const [link, text] = p1.split('|');
      return `[${text}](/starter-static-site/${slugify(link)}.html)`;
    }
    return `[${p1}](/starter-static-site/${slugify(p1)}.html)`;
  });

  console.log('Processed content:', content);
  return content;
}

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

function extractInternalLinks(content) {
  const links = new Set();
  const linkRegex = /\[\[(.*?)\]\]/g;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    // Skip if this is an image link (starts with !)
    if (content.charAt(match.index - 1) === '!') continue;
    
    const link = match[1].split('|')[0]; // Get the link part before any |
    links.add(link.trim()); // Ensure we trim any whitespace
  }
  
  return Array.from(links);
}

function createPlaceholderContent(title) {
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  return `---
title: ${title}
date: ${today}
description: A future exploration
type: rabbit-hole
status: stub
---

# ${title}

This is a side path in this rabbit hole that I haven't gone down yet.
`;
}

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
  
  // Process markdown files
  const contentDir = path.join(__dirname, '../src/content');
  
  // Track rabbit hole posts for the index
  const rabbitHolePosts = [];
  
  // Collect all internal links and existing files
  const allInternalLinks = new Set();
  const existingFiles = new Set();
  
  // First pass: collect existing files and all internal links
  const files = await fs.readdir(contentDir);
  for (const file of files) {
    if (file.endsWith('.md')) {
      existingFiles.add(file.replace('.md', ''));
      const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
      extractInternalLinks(content).forEach(link => allInternalLinks.add(link));
    }
  }

  // Create placeholder files for missing links
  for (const link of allInternalLinks) {
    const safePath = path.join(contentDir, `${slugify(link)}.md`);
    if (!existingFiles.has(slugify(link))) {
      if (!fs.existsSync(safePath)) {
        await fs.writeFile(
          safePath,
          createPlaceholderContent(link)
        );
        console.log(`Created placeholder for: ${link}`);
      }
    }
  }
  
  // Process all markdown files
  for (const file of files) {
    if (file.endsWith('.md') && !file.startsWith('_')) {
      const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
      const { attributes, body } = frontMatter(content);
      const processedBody = convertObsidianLinks(body);
      let html = marked(processedBody);
      
      // If this is a rabbit hole post, add it to the list
      if (attributes.type === 'rabbit-hole') {
        rabbitHolePosts.push({
          title: attributes.title,
          date: attributes.date,
          description: attributes.description,
          url: `/starter-static-site/${slugify(file.replace('.md', ''))}.html`,
          status: attributes.status || 'published'
        });
      }
      
      // If this is the rabbit holes index, inject the posts list
      if (file === 'rabbit-holes.md') {
        const postsHtml = rabbitHolePosts
          .sort((a, b) => new Date(b.date) - new Date(a.date))
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
      
      const finalHtml = template
        .replace('{{title}}', attributes.title || 'My Site')
        .replace('{{content}}', html);
      
      const outFile = slugify(file.replace('.md', '')) + '.html';
      await fs.writeFile(
        path.join(__dirname, '../public', outFile),
        finalHtml
      );
    }
  }
}

build().catch(console.error); 