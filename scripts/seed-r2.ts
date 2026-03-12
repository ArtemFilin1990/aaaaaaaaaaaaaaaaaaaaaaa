import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { extractProducts, processSpec } from '../src/spec-processor'

const OPENAPI_SPEC_URL =
  'https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json'
const BUCKET_NAME = 'cloudflare-worker-mcp-spec'

console.log(`Fetching OpenAPI spec from ${OPENAPI_SPEC_URL}...`)
const response = await fetch(OPENAPI_SPEC_URL)
if (!response.ok) {
  throw new Error(`Failed to fetch spec: ${response.status}`)
}

const rawSpec = (await response.json()) as Record<string, unknown>
console.log('Processing spec, resolving $refs...')

const processed = processSpec(rawSpec)
const specJson = JSON.stringify(processed)

const products = extractProducts(rawSpec)
const productsJson = JSON.stringify(products)

console.log(`Spec: ${(specJson.length / 1024 / 1024).toFixed(1)} MB, ${products.length} products`)

const tmp = mkdtempSync(join(tmpdir(), 'cloudflare-worker-mcp-seed-'))
const specPath = join(tmp, 'spec.json')
const productsPath = join(tmp, 'products.json')

try {
  writeFileSync(specPath, specJson)
  writeFileSync(productsPath, productsJson)

  for (const [key, path] of [
    ['spec.json', specPath],
    ['products.json', productsPath]
  ] as const) {
    console.log(`Uploading ${key} to R2 bucket ${BUCKET_NAME}...`)
    execSync(
      `npx wrangler r2 object put ${BUCKET_NAME}/${key} --file "${path}" --content-type application/json --remote`,
      { stdio: 'inherit' }
    )
  }

  console.log('Done!')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
