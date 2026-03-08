const handleLeadAutomation = async (lead, previousStatus) => {
  const currentStatus = lead.status;

  if (previousStatus === currentStatus) return;

  console.log(`⚙️ Status automation triggered for ${lead.name}`);

  switch (currentStatus) {

    case "contacted":
      console.log(`📞 Lead contacted: ${lead.name}`);
      break;

    case "interested":
      console.log(`🔥 Lead interested: ${lead.name}`);
      break;

    case "closed":
      console.log(`✅ Lead closed: ${lead.name}`);
      break;

    default:
      break;
  }
};

module.exports = handleLeadAutomation;