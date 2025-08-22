export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const user = url.searchParams.get("user");
      const activitiesParam = url.searchParams.get("activities"); // format: pushups:done,squats:skipped

      if (!user || !activitiesParam) {
        return new Response("Missing parameters: user or activities", { status: 400 });
      }

      // Parse activities
      // Example: "pushups:done,squats:skipped"
      const activities = activitiesParam.split(",").map(item => {
        const [activity, status] = item.split(":");
        return { activity, status, time: new Date().toISOString() };
      });

      // GitHub repo details
      const repo = "username/gym-responses";      // change this
      const filePath = `responses/${user}.json`;  // one file per user
      const githubToken = env.GITHUB_TOKEN;

      const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
      const headers = {
        Authorization: `token ${githubToken}`,
        "User-Agent": "cloudflare-worker",
        Accept: "application/vnd.github.v3+json",
      };

      // 1. Fetch existing file if it exists
      let userActivities = [];
      let sha = null;
      const res = await fetch(fileUrl, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.content) {
          const decoded = atob(json.content);
          userActivities = JSON.parse(decoded);
          sha = json.sha;
        }
      }

      // 2. Add new activities
      userActivities.push(...activities);

      // 3. Encode and commit to GitHub
      const updatedContent = btoa(JSON.stringify(userActivities, null, 2));
      const commit = await fetch(fileUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Add activities for ${user}`,
          content: updatedContent,
          sha,
        }),
      });

      if (!commit.ok) {
        return new Response("GitHub commit failed", { status: 500 });
      }

      return new Response(`Stored ${activities.length} activities for ${user}`);

    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
