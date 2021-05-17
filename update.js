const Spreadparser = require('spreadparser');
const axios = require('axios').default;
const fs = require('fs');
const JSONPostsPath = './_posts/posts.json';

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
        const previousPost = currentPosts.find(currentPost => currentPost.slug === newPost.slug);
        const isNewPost = previousPost !== null;
        const isUpdated = isNewPost ? true : previousPost.version < newPost.version;
        return isNewPost || isUpdated;
    });
};

const writePostsToFiles = (postsList) => {
    postsList.forEach(post => {
        writeFile(`${post.slug}.md`, JSON.stringify(post));
    })
};

async function update() {
    const postsFromSpreadsheet = await getPostsFromSpreadsheet();
    const postsFromJSON = await getPostsFromJSON();
    const postToUpdate = filterPostsToUpdate(postsFromJSON, postsFromSpreadsheet);
    writePostsToFiles(postToUpdate);
    return `${postToUpdate.length} posts updated.`;
}

update()
    .then(responses => console.log(responses));
