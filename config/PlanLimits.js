module.exports = {

  free: {
    price: 0,
    followUps: 50,
    aiReplies: 0,
    aiQualification: 0,
    teamMembers: 1,
    knowledgeDocuments: 0,
    features: {
      whatsapp: false,
      templates: false,
      advancedAnalytics: false,
      facebookLeadAds: false,
      aiLeadQualification: false,
      aiSalesAgent: false
    }
  },

  starter: {
    price: 499,
    followUps: 2000,
    aiReplies: 100,
    aiQualification: 0,
    teamMembers: 2,
    knowledgeDocuments: 20,
    features: {
      whatsapp: true,
      templates: true,
      advancedAnalytics: false,
      facebookLeadAds: false,
      aiLeadQualification: false,
      aiSalesAgent: false
    }
  },

  pro: {
    price: 999,
    followUps: 10000,
    aiReplies: 2000,
    aiQualification: 500,
    teamMembers: 10,
    knowledgeDocuments: 100,
    features: {
      whatsapp: true,
      templates: true,
      advancedAnalytics: true,
      facebookLeadAds: true,
      aiLeadQualification: true,
      aiSalesAgent: false
    }
  },

  agent: {
    price: 1499,
    followUps: 30000,
    aiReplies: 10000,
    aiQualification: 5000,
    teamMembers: Infinity,
    knowledgeDocuments: Infinity,
    features: {
      whatsapp: true,
      templates: true,
      advancedAnalytics: true,
      facebookLeadAds: true,
      aiLeadQualification: true,
      aiSalesAgent: true
    }
  }

};