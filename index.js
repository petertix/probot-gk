
const pWaitFor = require('p-wait-for');
//import pWaitFor from 'p-wait-for';

module.exports = robot => {

  console.log("The probot App was loaded!");

  robot.on('pull_request.opened', handlePrOpened);
  robot.on('pull_request.labeled', handleLabeled);

  async function handleLabeled (context) {
    const { payload } = context;

    console.log("The issue was Labeled");
    console.log(payload);
    
    return;
  }

  async function handlePrOpened (context) {
    const { payload } = context;
    const {github} = context;
    const {issue} = context.payload;
    
    // << Debug Start >>
    // ------------------------------------------------------------------------
    //console.log(context);
    console.log("Hey, a PR was Opened");
    console.log("payload.number: " + payload.number);
    console.log("payload.pull_request.state: " + payload.pull_request.state);
    console.log("payload.pull_request.title: " + payload.pull_request.title);
    console.log("payload.pull_request.user.login: " + payload.pull_request.user.login);
    console.log("payload.pull_request.user.type: " + payload.pull_request.user.type);
    // console.log("payload.pull_request.body: " + payload.pull_request.body);
    console.log("payload.pull_request.statuses_url: " + payload.pull_request.statuses_url);
    console.log("payload.pull_request.head.ref: " + payload.pull_request.head.ref);
    console.log("payload.pull_request.head.sha: " + payload.pull_request.head.sha);
    console.log("payload.pull_request.merged: " + payload.pull_request.merged);
    console.log("payload.sender.login: " + payload.sender.login);
    console.log("payload.sender.type: " + payload.sender.type);
    console.log("owner:" + payload.sender.login);
    console.log("repo: " + payload.repository.name);
    console.log("ref: " + payload.pull_request.head.ref);
    
    // Test fetching the current status of the PR
    const theStatus = await github.repos.getCombinedStatusForRef(
      context.repo({
        // owner: payload.sender.login,
        repo: payload.repository.name,
        ref: payload.pull_request.head.sha,
        // ref: payload.pull_request.head.ref,
      }),
    );
    
    //console.log("theStatus: " + theStatus);
    // console.log(theStatus);
    
    console.log("state: " + theStatus.data.state);
    console.log("sha: " + theStatus.data.sha);
    console.log("description: " + theStatus.data.repository.description);
    
    // console.log(theStatus.data.statuses);
    
    // ------------------------------------------------------------------------
    // << Debug End >>
    
    // Fetch the User's permissions 
    const permissions = await github.repos.reviewUserPermissionLevel(
      context.repo({
        username: payload.sender.login,
        // username: user.login,
      }),
    );

    // console.log(permissions);
    
    // If the User's permissions can not perform the merge, then return
    const level = permissions.data.permission;
    console.log("permissions.data.permission: " + permissions.data.permission);

    if (level !== 'admin') { // Check write permission, also.
      console.log(">>> The User's permissions are not at level: admin. <<<");
      console.log('>>> This User can not perform a Merge <<<');
      console.log('User: ' + payload.sender.login);
      // return;
    }

    // ++ This is the Main Polling loop ++
    // Wait for the state of the PR to change from pending to
    // success or failure. Poll every 5000ms (5 sec).

    let repoName = payload.repository.name;
    let refSha = payload.pull_request.head.sha;

    pWaitFor(() => fetchPrState(repoName,refSha),5000).then(() => {
      console.log('The status is no longer pending');
    })


    // The fetchPrState function is polled repeatedly until the
    // PR state changes to a non-pending state.
    // If the state is: success, then attempt to merge the PR.
    // If the state is: failure or non-pending, then return.
    //
    async function fetchPrState (repoName, refSha) {
      let stopPolling = false;

      // Fetch the combined status of the PR from all CI test results.
      const prStatus = await github.repos.getCombinedStatusForRef(
        context.repo({
          repo: repoName,
          ref: refSha,
        }),
      );

      console.log('Pull Request State: ' + prStatus.data.state);

      // Check if the state is no longer in the pending state
      if (prStatus.data.state === 'failure') {
        stopPolling = true;
        console.log('>>> One or more CI tests have failed. <<<');
        console.log("The PR State is now: " +  prStatus.data.state);
        console.log('The PR will NOT be Merged.');
      }
      else if (prStatus.data.state === 'success') {
        
        stopPolling = true;
        console.log("The PR State is now: " +  prStatus.data.state);
        console.log('>>> The CI tests have Passed. <<<');
        console.log('The PR will be Merged now...skipping while Testing');

        // Attempt to merge the Pull Request
        // Try to perform the merge with the issue Number, title, 
        // commit message and the merge method.
        try {
          await github.pullRequests.merge(
            context.repo({
              number: issue.number,
              commit_title: issue.title,
              commit_message: issue.html_url,
              merge_method,
            }),
          );

          console.log('Made it 10!');

        } catch (err) {
          console.log(err.code);
          
          if (err.code === 405) {
            const message = JSON.parse(err.message).message;
            github.issues.createComment(
              context.issue({
                body: `Failed to merge PR: ${message}`,
              }),
            );
          }

          // A 403 suggests that the github App's permissions and webhooks need addressing
          else if (err.code === 403) {
            const message = JSON.parse(err.message).message;
            console.log(message);

          //  github.issues.createComment(
          //    context.issue({
          //      body: `Failed to merge PR: ${message}`,
          //    }),
          //  );
          }

          console.log('Made it 20');
        }
      }
      else if (prStatus.data.state !== 'pending') {
        stopPolling = true;
        console.log('>>> Invalid State. The PR state is not success|failure|polling <<<');
        console.log("The PR State is now: " +  prStatus.data.state);
        console.log('The PR will NOT be Merged.');
      }
      
      return stopPolling;
    }

    return;
  }
};
