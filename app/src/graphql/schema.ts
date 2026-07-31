export const typeDefs = `#graphql
  type COSNode {
    id: ID!
    type: Int!
    label: String!
    properties: JSON
    source: String!
    createdAt: String!
    updatedAt: String!
  }

  type COSEdge {
    source: String!
    target: String!
    type: String!
    weight: Float!
    createdAt: String!
  }

  type Campaign {
    id: ID!
    name: String!
    budget: Float
    platform: String
    status: String
    roi: Float
  }

  type Agent {
    id: ID!
    name: String!
    type: String!
    status: String!
  }

  type AgencyEvent {
    id: ID!
    type: String!
    source: String!
    data: JSON
    createdAt: String!
  }

  type SystemHealth {
    total: Int!
    healthy: Int!
    degraded: Int!
    repos: [RepoHealth!]!
  }

  type RepoHealth {
    name: String!
    url: String!
    status: String!
    lastHeartbeat: String
  }

  type GraphStats {
    totalNodes: Int!
    byLevel: JSON
    bySource: JSON
  }

  type RAGResult {
    answer: String!
    sources: [Source!]!
    queryTime: Int!
  }

  type Source {
    id: String!
    label: String!
  }

  type OptimizationResult {
    suggestions: [String!]!
    similarCampaigns: [String!]!
  }

  scalar JSON

  type Query {
    nodes(level: Int, source: String, limit: Int): [COSNode!]!
    node(id: ID!): COSNode
    search(query: String!, limit: Int): [COSNode!]!
    graphStats: GraphStats!
    campaigns: [Campaign!]!
    campaign(id: ID!): Campaign
    campaignOptimization(id: ID!): OptimizationResult
    agents: [Agent!]!
    systemHealth: SystemHealth!
    ragQuery(question: String!, campaignId: String): RAGResult!
  }

  type Mutation {
    addNode(id: ID!, type: Int!, label: String!, source: String!): COSNode!
    deleteNode(id: ID!): Boolean!
  }
`;