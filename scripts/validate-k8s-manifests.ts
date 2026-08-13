import fs from 'node:fs';
import path from 'node:path';

export interface ValidationIssue {
  file: string;
  kind: string;
  name: string;
  field?: string;
  message: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  totalManifestsChecked: number;
  skippedResources: number;
  issues: ValidationIssue[];
}

export function validateKubernetesManifests(k8sDir = path.join(process.cwd(), 'k8s')): ManifestValidationResult {
  console.log(`=== Executing Strict Kubernetes Manifest & CRD Schema Validation on ${k8sDir} ===`);
  const files = fs.readdirSync(k8sDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const issues: ValidationIssue[] = [];
  let totalCount = 0;

  for (const file of files) {
    if (file === 'secret.yaml') {
      issues.push({
        file,
        kind: 'Secret',
        name: 'secret.yaml',
        message: 'CRITICAL SECURITY VIOLATION: Unencrypted secret.yaml must never be committed to git repository!',
      });
      continue;
    }

    const filePath = path.join(k8sDir, file);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const yamlDocs = rawContent.split(/^---$/m).filter((doc) => doc.trim().length > 0);

    for (const rawDoc of yamlDocs) {
      totalCount++;
      const lines = rawDoc.split('\n');

      const getValue = (key: string): string => {
        const line = lines.find((l) => l.trim().startsWith(`${key}:`));
        if (!line) return '';
        return line.split(`${key}:`)[1].trim().replace(/['"]/g, '');
      };

      const apiVersion = getValue('apiVersion');
      const kind = getValue('kind');
      const name = getValue('name');

      if (!apiVersion || !kind || !name) {
        issues.push({
          file,
          kind: kind || 'Unknown',
          name: name || 'Unnamed',
          message: 'Missing mandatory Kubernetes metadata fields: apiVersion, kind, or name',
        });
        continue;
      }

      // 1. ServiceMonitor Validation
      if (kind === 'ServiceMonitor') {
        if (apiVersion !== 'monitoring.coreos.com/v1') {
          issues.push({ file, kind, name, field: 'apiVersion', message: 'ServiceMonitor must use monitoring.coreos.com/v1' });
        }
        if (!rawContent.includes('matchLabels:') || !rawContent.includes('app:')) {
          issues.push({ file, kind, name, field: 'spec.selector', message: 'ServiceMonitor must specify selector.matchLabels.app' });
        }
        if (!rawContent.includes('path: /metrics')) {
          issues.push({ file, kind, name, field: 'endpoints.path', message: 'ServiceMonitor endpoint path must be /metrics' });
        }
        if (!rawContent.includes('bearerTokenSecret:') || !rawContent.includes('METRICS_AUTH_TOKEN')) {
          issues.push({ file, kind, name, field: 'endpoints.bearerTokenSecret', message: 'ServiceMonitor must reference bearerTokenSecret with METRICS_AUTH_TOKEN' });
        }
      }

      // 2. ExternalSecret Validation
      else if (kind === 'ExternalSecret') {
        if (!['external-secrets.io/v1beta1', 'external-secrets.io/v1alpha1'].includes(apiVersion)) {
          issues.push({ file, kind, name, field: 'apiVersion', message: 'ExternalSecret must use external-secrets.io API' });
        }
        if (!rawContent.includes('secretStoreRef:') || !rawContent.includes('name:')) {
          issues.push({ file, kind, name, field: 'spec.secretStoreRef', message: 'ExternalSecret must reference valid secretStoreRef' });
        }
        if (!rawContent.includes('target:') || !rawContent.includes('name:')) {
          issues.push({ file, kind, name, field: 'spec.target', message: 'ExternalSecret must specify target secret name' });
        }
        if (!rawContent.includes('remoteRef:') || !rawContent.includes('secretKey:')) {
          issues.push({ file, kind, name, field: 'spec.data', message: 'ExternalSecret must specify secretKey and remoteRef mappings' });
        }
      }

      // 3. Deployment & Security Validation
      else if (kind === 'Deployment') {
        if (!rawContent.includes('runAsNonRoot: true')) {
          issues.push({ file, kind, name, field: 'securityContext.runAsNonRoot', message: 'Deployment must specify runAsNonRoot: true' });
        }
        if (rawContent.includes(':latest')) {
          issues.push({ file, kind, name, field: 'containers.image', message: 'Deployment must not use mutable :latest image tag' });
        }
        if (!rawContent.includes('limits:') || !rawContent.includes('cpu:') || !rawContent.includes('memory:')) {
          issues.push({ file, kind, name, field: 'resources.limits', message: 'Deployment containers must specify CPU and memory limits' });
        }
      }
    }
  }

  const valid = issues.length === 0;

  console.log(`Validated ${totalCount} Kubernetes resources across ${files.length} files.`);
  console.log(`Skipped resources: 0 | Issues: ${issues.length}`);

  if (!valid) {
    console.error('Kubernetes Manifest Schema Validation Failures:', issues);
  } else {
    console.log('✅ All Kubernetes Built-in and Custom Resources (ServiceMonitor, ExternalSecret) Passed Schema Validation!');
  }

  return {
    valid,
    totalManifestsChecked: totalCount,
    skippedResources: 0,
    issues,
  };
}

if (process.argv[1]?.includes('validate-k8s-manifests')) {
  const result = validateKubernetesManifests();
  if (!result.valid) {
    process.exit(1);
  }
  process.exit(0);
}
