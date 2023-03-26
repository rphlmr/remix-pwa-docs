import { request } from "@octokit/request";
import { Repo } from "../handlers/github-api";

const octokit = request.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_KEY}`
  }
})

export const getPostContent = async (slug: string) => {
  const postData = await octokit("GET /repos/{owner}/{repo}/contents/{path}", {
    ...Repo,
    path: `posts/${slug}.mdx`,
    ref: "main"
  });

  if (postData.status !== 200) {
    return null;
  }

  //@ts-ignore
  const content = await fetch(postData.data.download_url).then(res => res.text());

  return content;
}

export const getPostMetaData = async () => {
  const meta = await octokit("GET /repos/{owner}/{repo}/contents/{path}", {
    ...Repo,
    path: "posts/metadata.json",
    ref: "docs"
  });

  //@ts-ignore
  const content = await fetch(meta.data.download_url).then(res => res.text());

  return JSON.parse(content);
}