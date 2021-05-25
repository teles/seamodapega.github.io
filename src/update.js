const Spreadparser = require('spreadparser');
const axios = require('axios').default;
const fs = require('fs');
const matter = require('gray-matter');
const TurndownService = require('turndown');
const jsdom = require('jsdom');
const {JSDOM} = jsdom;
global.DOMParser = new JSDOM().window.DOMParser;

const lineToPost = line => {
    return JSON.parse(JSON.stringify({
        category: line.category,
        description: line.description,
        document: line.document,
        image: line.image && line.image.src ? {
            src: line.image.src
        } : undefined,
        published: line.published || true,
        slug: line.slug,
        tags: line.tags ? line.tags.split(',').map(tag => tag.trim()) : undefined,
        title: line.title,
        version: line.version

    }));
};
const postToFrontmatterData = (post, markdown) => {
    return JSON.parse(JSON.stringify({
        category: post.category,
        description: post.description,
        image: post.image,
        published: post.published,
        slug: post.slug,
        tags: post.tags,
        title: post.title || markdown.title,
        version: post.version
    }));
};

const getPostsFromSpreadsheet = (spreadsheetId, sheetNumber) => {
    return axios.get(Spreadparser.getSpreadsheetUrl(spreadsheetId, sheetNumber))
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

const getPostsFromJSON = (outputDir) => {
    const JSONPath = `${outputDir}/data.json`;

    return new Promise((resolve) => {
        readFile(JSONPath)
            .then(contents => resolve(JSON.parse(contents)))
            .catch(() => {
                writeFile(JSONPath, '[]')
                    .then(() => resolve([]))
            })
    });
};

const filterPostsToUpdate = (originalPosts, newPosts, shouldForceUpdate) => {
    return shouldForceUpdate ? newPosts : newPosts.filter(newPost => {
        const previousPost = originalPosts.find(currentPost => currentPost.slug === newPost.slug) || null;
        const isNewPost = previousPost === null;
        const isUpdated = isNewPost ? true : previousPost.version < newPost.version;
        return isNewPost || isUpdated;
    });
};

const getMarkdownFromDocs = async (post) => {
    const removeGoogleAnchorStuff = (originalLink) => {
        const match = originalLink.match(/google.com\/url\?q=([^&]+)/) || null;
        return match ? match[1] : originalLink;
    };

    const anchorFilter = {
        filter: 'a',
        replacement: function (content, node) {
            return `<a href='${removeGoogleAnchorStuff(node.getAttribute('href'))}'>${content}</a>`;
        }
    };
    const turndown = new TurndownService({headingStyle: 'atx'});
    turndown
        .remove('style')
        .remove('script')
        .addRule('anchor', anchorFilter);

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

const writePostsToFiles = async (originalPosts, postsToUpdate, outputDir) => {
    const JSONPath = `${outputDir}/data.json`;

    await postsToUpdate.forEach(async post => {
        const markdown = await getMarkdownFromDocs(post);
        const fileName = `${outputDir}/${post.slug}.md`;
        await writeFile(fileName, matter.stringify(markdown.content, postToFrontmatterData(post, markdown)));
        await writeFile(JSONPath, JSON.stringify(Object.assign(originalPosts, postsToUpdate), null, 2));
    });
};

async function update(spreadsheetId, options = {}) {
    fs.mkdir(options.outputDir, { recursive: true }, (err) => {
        if (err) throw err;
    });
    const postsFromSpreadsheet = await getPostsFromSpreadsheet(spreadsheetId, options.sheetNumber);
    const postsFromJSON = await getPostsFromJSON(options.outputDir);
    const postsToUpdate = filterPostsToUpdate(postsFromJSON, postsFromSpreadsheet, options.shouldForceUpdate );
    await writePostsToFiles(postsFromJSON, postsToUpdate, options.outputDir);
    return `${postsToUpdate.length} posts updated.`;
}

module.exports = update;
