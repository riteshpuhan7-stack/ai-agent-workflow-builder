import { GraphQLClient } from 'graphql-request'

const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:8081/v1/graphql'
const adminSecret = process.env.NHOST_ADMIN_SECRET || 'nhost-admin-secret'

export function getGraphQLClient() {
  return new GraphQLClient(endpoint, {
    headers: { 'x-hasura-admin-secret': adminSecret }
  })
}
