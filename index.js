// Copyright (c) 2017 Intel Corporation. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

const pWaitFor = require('p-wait-for');

module.exports = robot => {
  robot.on('pull_request.opened', async c =>
    handlePrOpened(c).catch(e => console.error(e))
  );

  robot.on('pull_request.reopened', async c =>
    handlePrOpened(c).catch(e => console.error(e))
  );
  
  async function handlePrOpened(context) {
    const { payload, github } = context;
    const pr = payload.pull_request;

    // If the sender of the PR is not greenkeeper, then return
    if (pr.user.login !== 'greenkeeper[bot]') return;

    const repoName = payload.repository.name;
    const refSha = pr.head.sha;

    await pWaitFor(() => fetchPrState(repoName, refSha), 5000);

    await github.repos.removeProtectedBranchPullRequestReviewEnforcement(
      context.repo({
        branch: 'master'
      })
    );

    await github.pullRequests.merge(
      context.repo({
        number: pr.number,
        commit_title: pr.title,
        commit_message: pr.html_url,
        merge_method: 'squash'
      })
    );

    await github.repos.updateProtectedBranchPullRequestReviewEnforcement(
      context.repo({
        branch: 'master',
        dismiss_stale_reviews: true
      })
    );

    // The fetchPrState function is polled repeatedly until the
    // PR state changes to a non-pending state.
    async function fetchPrState(repo, ref) {
      const prStatus = await github.repos.getCombinedStatusForRef(
        context.repo({
          repo,
          ref
        })
      );

      return prStatus.data.state === 'success';
    }
  }
};