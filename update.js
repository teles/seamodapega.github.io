const Spreadparser = require('spreadparser');
const axios = require('axios').default;
const fs = require('fs');
const matter = require('gray-matter');
const TurndownService = require('turndown');
const JSONPostsDir = './_posts';
const JSONPostsPath = `${JSONPostsDir}/posts.json`;
const jsdom = require("jsdom");
const {JSDOM} = jsdom;
global.DOMParser = new JSDOM().window.DOMParser;

const lineToPost = line => {
    return JSON.parse(JSON.stringify({
        slug: line.slug,
        tags: line.tags ? line.tags.split(',').map(tag => tag.trim()) : undefined,
        version: line.version,
        title: line.title,
        document: `https://docs.google.com/document/d/e/${line.document}/pub`
    }));
};
const postToFrontmatterData = (post, markdown) => {
    return JSON.parse(JSON.stringify({
        title: post.title ||  markdown.title,
        tags: post.tags,
        version: post.version,
        document: post.document,
        slug: post.slug
    }));
};

const getPostsFromSpreadsheet = (spreadsheetId) => {
    return axios.get(Spreadparser.getSpreadsheetUrl(spreadsheetId))
        .then(response => response.data)
        .then(data => Spreadparser.parse(data).data)
        .then(lines => lines.map(lineToPost))
        .catch(error => console.log(error));
};

const readFile = file => new Promise((resolve, reject) => {
    fs.readFile(file, (err, contents) => {
        err ? reject(err) : resolve(contents);
    })
});

const writeFile = (fileName, contents) => new Promise((resolve, reject) => {
    fs.writeFile(fileName, contents, (err) => {
        err ? reject(err) : resolve(contents);
    })
});

const getPostsFromJSON = () => {
    return new Promise((resolve) => {
        readFile(JSONPostsPath)
            .then(contents => resolve(JSON.parse(contents)))
            .catch(() => {
                writeFile(JSONPostsPath, '[]')
                    .then(() => resolve([]))
            })
    })
};

const filterPostsToUpdate = (originalPosts, newPosts) => {
    return newPosts.filter(newPost => {
        const previousPost = originalPosts.find(currentPost => currentPost.slug === newPost.slug) || null;
        const isNewPost = previousPost === null;
        const isUpdated = isNewPost ? true : previousPost.version < newPost.version;
        return isNewPost || isUpdated;
    });
};

const getMarkdownFromDocs = async (post) => {
    const turndown = new TurndownService({headingStyle: 'atx'});
    turndown.remove('style').remove('script');

    return new Promise((resolve, reject) => {
        axios.get(post.document)
            .then(response => {
                const parser = new DOMParser();
                const html = parser.parseFromString(response.data, 'text/html');
                const content = html.querySelector('#contents').innerHTML;
                const title = html.querySelector('title').innerHTML;
                resolve({
                    title,
                    content: turndown.turndown(content)
                });
            }).catch(err => reject(err));
    })
};

const writePostsToFiles = async (originalPosts, postsToUpdate) => {
    await postsToUpdate.forEach(async post => {
        const markdown = await getMarkdownFromDocs(post);
        const fileName = `${JSONPostsDir}/${post.slug}.md`;
        await writeFile(fileName, matter.stringify(markdown.content, postToFrontmatterData(post, markdown)));
        await writeFile(JSONPostsPath, JSON.stringify(Object.assign(originalPosts, postsToUpdate), null, 2));
    });
};

async function update(spreadsheetId) {
    const postsFromSpreadsheet = await getPostsFromSpreadsheet(spreadsheetId);
    const postsFromJSON = await getPostsFromJSON();
    const postsToUpdate = filterPostsToUpdate(postsFromJSON, postsFromSpreadsheet);
    await writePostsToFiles(postsFromJSON, postsToUpdate);
    return `${postsToUpdate.length} posts updated.`;
}

update('1DttyM08d5C8NoCBEnadJLCY1w34DAabk_fZg07MR9ng')
    .then(responses => console.log(responses));
