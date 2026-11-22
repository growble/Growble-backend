const handleLeadAutomation = async (lead, previousStatus) => {
  const currentStatus = lead.status;

  if (previousStatus === currentStatus) return;

  console.log(`⚙️ Status automation triggered for ${lead.name}`);

  switch (currentStatus) {

    case "qualified":
      console.log(`🔥 Lead qualified: ${lead.name}`);
      break;

    case "proposal":
      console.log(`📄 Proposal sent: ${lead.name}`);
      break;

    case "negotiation":
      console.log(`🤝 Lead in negotiation: ${lead.name}`);
      break;

    case "closed_won":
      console.log(`✅ Deal won: ${lead.name}`);
      break;

    case "closed_lost":
      console.log(`❌ Deal lost: ${lead.name}`);
      break;

    default:
      break;
  }
};

module.exports = handleLeadAutomation;