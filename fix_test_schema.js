const fs = require('fs');
const path = './src/tests/integration/m3-spec04-80-vectors.test.ts';
let code = fs.readFileSync(path, 'utf8');

// Insert the object_registry and registered_control_plane_revision_payloads mock for 'schema-policy-dsl-v1'
const target = `    await sql\`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES 
        ('SchemaDefinition', 'schema-policy-dsl', 'schema-policy-dsl-v1', \${tenantA}),
        ('MetricDefinitionRevision', \${metricStable}, \${metricRevId}, \${tenantA}),
        ('TaskContractRevision', \${taskStable}, \${taskRevId}, \${tenantA})
      ON CONFLICT DO NOTHING
    \`;`;

const replacement = `    const schemaObjId = uid('obj-schema');
    const schemaHash = uid('hash-schema');
    await sql\`
      INSERT INTO object_registry (object_id, tenant_id, content_hash, object_key, size_bytes, media_type, state)
      VALUES (\${schemaObjId}, \${tenantA}, \${schemaHash}, 'schema.json', 100, 'application/json', 'AVAILABLE')
      ON CONFLICT DO NOTHING
    \`;
    await sql\`
      INSERT INTO revision_registry (entity_type, stable_id, revision_id, tenant_id)
      VALUES 
        ('SchemaDefinition', 'schema-policy-dsl', 'schema-policy-dsl-v1', \${tenantA}),
        ('MetricDefinitionRevision', \${metricStable}, \${metricRevId}, \${tenantA}),
        ('TaskContractRevision', \${taskStable}, \${taskRevId}, \${tenantA})
      ON CONFLICT DO NOTHING
    \`;
    await sql\`
      INSERT INTO registered_control_plane_revision_payloads (
        entity_type, stable_id, revision_id, tenant_id, object_id, payload_hash, payload_schema_revision_id
      ) VALUES (
        'SchemaDefinition', 'schema-policy-dsl', 'schema-policy-dsl-v1', \${tenantA}, \${schemaObjId}, \${schemaHash}, 'meta-schema-v1'
      ) ON CONFLICT DO NOTHING
    \`;`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(path, code);
  console.log("Mock fixed in main init block");
} else {
  console.log("Could not find init block");
}
