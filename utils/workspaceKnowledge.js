const KnowledgeDocument = require("../models/KnowledgeDocument");
const User = require("../models/User");
const { getWorkspaceOwnerId } = require("./workspace");

const MAX_CONTEXT_DOCUMENTS = 8;
const MAX_CONTEXT_LENGTH = 60000;

function getQueryTerms(query) {
  return [...new Set(
    String(query || "")
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) || []
  )];
}

async function getWorkspaceKnowledge(user, query) {
  const workspaceOwnerId = getWorkspaceOwnerId(user);
  const [owner, documents] = await Promise.all([
    user.workspaceOwner
      ? User.findById(workspaceOwnerId)
          .select("knowledgeBase businessName businessType offer services faq")
      : Promise.resolve(user),
    KnowledgeDocument.find({ workspaceOwner: workspaceOwnerId })
      .select("name text createdAt")
      .sort({ createdAt: -1 })
  ]);
  const terms = getQueryTerms(query);
  const rankedDocuments = documents
    .map((document) => {
      const lowerText = document.text.toLowerCase();
      const score = terms.reduce(
        (total, term) => total + (lowerText.includes(term) ? 1 : 0),
        0
      );
      return { document, score };
    })
    .sort((a, b) => b.score - a.score ||
      b.document.createdAt - a.document.createdAt)
    .slice(0, MAX_CONTEXT_DOCUMENTS)
    .map(({ document }) => `Document: ${document.name}\n${document.text}`);

  const baseKnowledge = owner?.knowledgeBase || "";
  let documentContext = "";
  for (const text of rankedDocuments) {
    const remaining = MAX_CONTEXT_LENGTH - documentContext.length;
    if (remaining <= 0) break;
    documentContext += `\n\n${text.slice(0, remaining)}`;
  }

  return [baseKnowledge, documentContext].filter(Boolean).join("\n\n");
}

module.exports = getWorkspaceKnowledge;
