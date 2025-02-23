const fs = require('fs-extra');
const { execSync } = require('child_process');
const path = require('path');

async function deploy() {
  try {
    // Ensure we're on main branch
    execSync('git checkout main');
    
    // Build the site
    execSync('npm run build');
    
    // Create and switch to gh-pages branch
    try {
      execSync('git checkout gh-pages');
    } catch {
      execSync('git checkout -b gh-pages');
    }
    
    // Copy public files to root
    const publicFiles = await fs.readdir('public');
    for (const file of publicFiles) {
      await fs.copy(
        path.join('public', file),
        path.join('.', file),
        { overwrite: true }
      );
    }
    
    // Add and commit
    execSync('git add .');
    execSync('git commit -m "Deploy site"');
    
    // Push to GitHub
    execSync('git push origin gh-pages -f');
    
    // Switch back to main branch
    execSync('git checkout main');
    
    console.log('Deployment successful!');
  } catch (error) {
    console.error('Deployment failed:', error);
  }
}

deploy(); 