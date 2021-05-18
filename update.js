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

const getPostsFromSpreadsheet = () => {
    return axios.get(Spreadparser.getSpreadsheetUrl('1zsbIRYDKQT_a3oHIIqS7cOai5zPPAEM6BC_FvGy6TD4'))
        .then(response => response.data)
        .then(data => Spreadparser.parse(data).data)
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
            .then(contents => resolve(contents))
            .catch(() => {
                writeFile(JSONPostsPath, '[]')
                    .then(() => resolve([]))
            })
    })
};

const filterPostsToUpdate = (currentPosts, newPosts) => {
    return newPosts.filter(newPost => {
        const previousPost = JSON.parse(currentPosts).find(currentPost => currentPost.slug === newPost.slug) || null;
        const isNewPost = previousPost === null;
        const isUpdated = isNewPost ? true : previousPost.version < newPost.version;
        return isNewPost || isUpdated;
    });
};

const getMarkdownFromDocs = async (id) => {
    const docsUrl = `https://docs.google.com/document/d/e/${id}/pub`;
    const turndown = new TurndownService({headingStyle: 'atx'});
    turndown.remove('style').remove('script');

    return new Promise((resolve, reject) => {
        axios.get(docsUrl)
            .then(response => {
                const parser = new DOMParser();
                const html = parser
                    .parseFromString(response.data, 'text/html')
                    .querySelector('#contents')
                    .innerHTML;
                resolve(turndown.turndown(html));
            }).catch(err => reject(err));
    })
};

const writePostsToFiles = async (postsList) => {
    const postsFromJSON = await getPostsFromJSON();

    postsList.forEach(async post => {
        const content = await getMarkdownFromDocs(post.body);
        const fileName = `${JSONPostsDir}/${post.slug}.md`;
        await writeFile(fileName, matter.stringify(content, post))
            .then(async () => {
                const updatedPost = JSON.parse(postsFromJSON).find(postFromJson => postFromJson.slug === post.slug) || null;

                if(updatedPost === null || (updatedPost && updatedPost.version > post.version)) {
                    const updatedJSON = JSON.parse(postsFromJSON).concat(post);
                    await writeFile(JSONPostsPath, JSON.stringify(updatedJSON));
                }
            });
        return post;
    });
};

async function update() {
    const postsFromSpreadsheet = await getPostsFromSpreadsheet();
    const postsFromJSON = await getPostsFromJSON();
    const postToUpdate = filterPostsToUpdate(postsFromJSON, postsFromSpreadsheet);
    await writePostsToFiles(postToUpdate);
    return `${postToUpdate.length} posts updated.`;
}

update()
    .then(responses => console.log(responses));
