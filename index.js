
const fetch = require('node-fetch');
//import fetch from 'node-fetch';

module.exports = robot => {
  
  let description = "";
  let passCount = 0;
  let inProgressCount = 0;

  console.log("The probot App was loaded!");
  
  robot.on('issue_comment.created', handleComment);
  robot.on('issue_comment.edited', handleComment);
  
  // robot.on('status', handleStatus);

  // async function handleStatus (context) {
  //   const { payload } = context;

  //   console.log("Peter, status");
  //   console.log(payload);
    
  //   return;
  // }

  // If an Open Pull Request had a comment created by the bot: GreenKeeper
  async function handleComment(context) {
    const { payload } = context;
    const {issue, comment} = context.payload;
    const {pull_request, state} = issue;
    const {user} = comment;
    
    console.log(user);
    console.log(user.login);
    console.log(user.type);
    console.log(user.site_admin);

    console.log(pull_request);
    console.log(state);
    console.log(user.type);

    //console.log(payload.state);

    //console.log(payload);
    
    // If the comment is in:
    // an Open Pull Request by a Valid user, then continue
    // Otherwise return
    // Change this to continue if the greenkeeper bot created the issue.
    if (!pull_request || state !== 'open' || user.type !== 'User') {
      return;
    }

    console.log('Made it 10');
    
    // Fetch the user's permissions
    const {github} = context;
    const permissions = await github.repos.reviewUserPermissionLevel(
      context.repo({
        username: user.login,
      }),
    );

    // If the User's permissions can not perform the merge, then return
    const level = permissions.data.permission;
    if (level !== 'admin' && level !== 'write') {
      return;
    }

    console.log(permissions);

    console.log('Made it 20');
    
    console.log(comment.body);

    console.log('Made it 24');

    // Use the pull_requests method, getAll
    const pull_requests = await github.pullRequests.getAll(
      context.repo({
        username: user.login,
      }),
    );

    console.log(pull_requests);

    const url =  pull_requests.data[0].statuses_url;

    console.log(url);

    // The statuses_url points to a json array of data.
    fetch(url)
    .then(
       function(response) {
        if (response.status !== 200) {
          console.log('Looks like there was a problem. Status Code: ' +
            response.status);
          return;
        }
  
        // Examine the text in the response
        response.json().then(function(data) {

          passCount = 0;
          // Loop through the json array
          for (let i=0; i<data.length; i++){
            description  = data[i].description;
            if (description === "The Travis CI build passed") {
              passCount++
            }
            else if (description === "The Travis CI build is in progress") {
              inProgressCount++
            }
            console.log(description);
          }

          console.log("passCount = " + passCount);
          console.log("inProgressCount = " + inProgressCount);
        });

      

      }
    )
    .catch(function(err) {
      console.log('Fetch Error :-S', err);
    });
  
    console.log(description);

    // fetch(url)
    // .then((resp) => resp.json())
    // .then(function(data) {
    //   let state = data[0].state
    // })
    // .catch(function(error) {
    //   console.log(error);
    // });  

   // console.log(data);

    console.log('Made it 26');

    // const status = await github.repos.getStatuses(
    //   context.repo({
    //     ref:f976a7385f088ca10832766fe991e870aca4940d,
    //   }),
    // );
    // console.log(status);

    // PETER

    console.log('Made it 30');
    
    console.log(issue.number);
    console.log(issue.title);
    console.log(issue.html_url);

    console.log('Made it 34');

  //  return;

    // //const { payload } = context;
    // context.github.pullRequests
    // .getComments({
    //   owner: payload.repository.owner.login,
    //   repo: payload.repository.name,
    //   number: issue.number
    // })
    // .then(console.log);

    // Do not merge - still testing
  return;

    const {merge_method} = {
      merge_method: 'merge',
    };

    console.log(merge_method);

    // Try to perform the merge with the issue Number, title, commit message and the merge method.
    try {
      await github.pullRequests.merge(
        context.repo({
          number: issue.number,
          commit_title: issue.title,
          commit_message: issue.html_url,
          merge_method,
        }),
      );

      console.log('Made it 40!');

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

      console.log('Made it 50');
    }
  }
};
