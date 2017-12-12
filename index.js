const pWaitFor = require('p-wait-for');

module.exports = robot => {
  console.log('The probot App was loaded!');

  robot.on('pull_request.opened', async c =>
    handlePrOpened(c).catch(e => {
      if (e.code === 405) {
        const message = JSON.parse(e.message).message;
        c.payload.issues.createComment(
          context.issue({
            body: `Failed to merge PR: ${message}`
          })
        );
      }
    })
  );

  robot.on('pull_request.labeled', handleLabeled);

  async function handleLabeled(context) {
    const { payload } = context;

    console.log('The issue was Labeled');

    return;
  }

  async function handlePrOpened(context) {
    const { payload } = context;
    const { github } = context;

    // If the state of the PR is not open, then return
    if (payload.pull_request.state !== 'open') {
      return;
    }

    // If the sender of the PR is not greenkeeper, then return
    if (payload.pull_request.user.login !== 'greenkeeper[bot]') {
      return;
    }

    // Fetch the User's permissions
    // The probot app user needs to have admin permission
    const permissions = await github.repos.reviewUserPermissionLevel(
      context.repo({
        username: payload.pull_request.user.login
        // username: user.login
      })
    );

    // console.log(permissions);

    // If the User's permissions can not perform the merge, then return
    const level = permissions.data.permission;
    console.log('permissions.data.permission: ' + permissions.data.permission);

    if (level !== 'admin') {
      // Check write permission, also.
      console.log(">>> The User's permissions are not at level: admin. <<<");
      console.log(
        '>>> The User:' + context.host + ' can not perform a Merge <<<'
      );
      // return;
    }

    // ++ This is the Main Polling loop ++
    // Wait for the state of the PR to change from pending to
    // success or failure. Poll every 5000ms (5 sec).

    let repoName = payload.repository.name;
    let refSha = payload.pull_request.head.sha;

    await pWaitFor(() => fetchPrState(repoName, refSha), 5000);

    console.log('Now, the merge...');
    console.log('number: ' + payload.pull_request.number);
    console.log('commit_title: ' + payload.pull_request.title);
    console.log('commit_message: ' + 'Auto merge of a green-keeper PR');
    console.log('\n...Still Testing...Merge did NOT Occur...\n');

    const message = 'This is an Automated message';
    github.issues.createComment(
      context.issue({
        body: `Attempting to merge PR: ${message}`
      })
    );

    //    return; // For Testing

    const { merge_method } = {
      merge_method: 'merge'
    };

    // Attempt to merge the Pull Request
    // Try to perform the merge with the issue Number, title,
    // commit message and the merge method.
    await github.pullRequests.merge(
      context.repo({
        number: payload.pull_request.number,
        commit_title: payload.pull_request.title,
        commit_message: payload.pull_request.html_url,
        merge_method
      })
    );

    // The fetchPrState function is polled repeatedly until the
    // PR state changes to a non-pending state.
    // If the state is: success, then attempt to merge the PR.
    // If the state is: failure or non-pending, then return.
    //
    async function fetchPrState(repoName, refSha) {
      // Fetch the combined status of the PR from all CI test results.
      const prStatus = await github.repos.getCombinedStatusForRef(
        context.repo({
          repo: repoName,
          ref: refSha
        })
      );

      console.log('State: ' + prStatus.data.state);

      return prStatus.data.state === 'success';
    }
  }
};
