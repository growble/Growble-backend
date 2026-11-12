function getWorkspaceOwnerId(user) {
  return user.workspaceOwner || user._id;
}

function getWorkspaceLeadQuery(user) {
  const workspaceOwnerId = getWorkspaceOwnerId(user);
  const clauses = [
    { workspaceOwner: workspaceOwnerId },
    { user: workspaceOwnerId, workspaceOwner: { $exists: false } }
  ];

  if (String(user._id) !== String(workspaceOwnerId)) {
    clauses.push({
      user: user._id,
      workspaceOwner: { $exists: false }
    });
  }

  return { $or: clauses };
}

module.exports = {
  getWorkspaceLeadQuery,
  getWorkspaceOwnerId
};
