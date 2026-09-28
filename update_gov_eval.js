const fs = require('fs');
const path = './src/persistence/relational/services/governance-persistence-service.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace the schema resolution block with one that does the join check
const target = `// Verify that the resolved schema revision exists in revision_registry as SchemaDefinition
        const [schemaDef] = await sqlTx\`
          SELECT revision_id
          FROM revision_registry
          WHERE entity_type = 'SchemaDefinition' AND revision_id = \${policySchemaRev}
        \`;
        if (!schemaDef) {
          throw new RegistryValidationError(
            'POLICY_SCHEMA_UNSUPPORTED',
            \`SchemaDefinition revision '\${policySchemaRev}' pinned by policy '\${policyRow.policy_revision_id}' does not exist in RevisionRegistry (SPEC04 §41, §110).\`,
          );
        }`;

const replacement = `// Verify exact immutable SchemaDefinition payload binding (Blocker 1)
        const [schemaDef] = await sqlTx\`
          SELECT 
            r.revision_id, 
            r.tenant_id as rev_tenant, 
            r.workspace_id as rev_workspace,
            p.payload_hash,
            p.object_id,
            o.state as obj_state,
            o.tenant_id as obj_tenant
          FROM revision_registry r
          LEFT JOIN registered_control_plane_revision_payloads p 
            ON r.entity_type = p.entity_type AND r.stable_id = p.stable_id AND r.revision_id = p.revision_id
          LEFT JOIN object_registry o
            ON p.object_id = o.object_id
          WHERE r.entity_type = 'SchemaDefinition' AND r.revision_id = \${policySchemaRev}
        \`;
        if (!schemaDef) {
          throw new RegistryValidationError(
            'POLICY_SCHEMA_UNSUPPORTED',
            \`SchemaDefinition revision '\${policySchemaRev}' does not exist (SPEC04 §41).\`,
          );
        }
        if (schemaDef.rev_tenant !== tenantId) {
          throw new RegistryValidationError(
            'POLICY_SCHEMA_UNSUPPORTED',
            \`SchemaDefinition revision '\${policySchemaRev}' belongs to wrong tenant (Cross-tenant schema lookup forbidden).\`,
          );
        }
        if (workspaceId && schemaDef.rev_workspace && schemaDef.rev_workspace !== workspaceId) {
          throw new RegistryValidationError(
            'POLICY_SCHEMA_UNSUPPORTED',
            \`SchemaDefinition revision '\${policySchemaRev}' belongs to wrong workspace.\`,
          );
        }
        if (!schemaDef.payload_hash || !schemaDef.object_id) {
          throw new RegistryValidationError(
            'POLICY_SCHEMA_UNSUPPORTED',
            \`SchemaDefinition revision '\${policySchemaRev}' has missing payload binding. Fail closed.\`,
          );
        }
        if (schemaDef.obj_tenant !== tenantId) {
          throw new RegistryValidationError(
            'POLICY_SCHEMA_UNSUPPORTED',
            \`SchemaDefinition payload object belongs to wrong tenant. Fail closed.\`,
          );
        }
        if (schemaDef.obj_state !== 'AVAILABLE') {
          throw new RegistryValidationError(
            'POLICY_SCHEMA_UNSUPPORTED',
            \`SchemaDefinition payload object is not AVAILABLE. Fail closed.\`,
          );
        }`;

code = code.replace(target, replacement);
fs.writeFileSync(path, code);
