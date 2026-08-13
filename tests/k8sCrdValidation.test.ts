import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { validateKubernetesManifests } from '../scripts/validate-k8s-manifests';

describe('Kubernetes CRD & Security Manifest Validation Suite', () => {
  it('passes strict schema validation for all production k8s manifests with zero skipped resources', () => {
    const res = validateKubernetesManifests(path.join(process.cwd(), 'k8s'));
    expect(res.valid).toBe(true);
    expect(res.skippedResources).toBe(0);
    expect(res.issues).toHaveLength(0);
  });

  it('fails validation when ServiceMonitor is malformed or missing bearerTokenSecret', () => {
    const tempDir = path.join(process.cwd(), 'output', 'temp-k8s-invalid-sm');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const malformedSm = `
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: bad-servicemonitor
spec:
  endpoints:
    - port: metrics
      path: /invalid-metrics
`;
    fs.writeFileSync(path.join(tempDir, 'invalid-sm.yaml'), malformedSm);

    try {
      const res = validateKubernetesManifests(tempDir);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.message.includes('ServiceMonitor must specify selector'))).toBe(true);
      expect(res.issues.some((i) => i.message.includes('endpoint path must be /metrics'))).toBe(true);
      expect(res.issues.some((i) => i.message.includes('bearerTokenSecret'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails validation when ExternalSecret is missing secretStoreRef or target name', () => {
    const tempDir = path.join(process.cwd(), 'output', 'temp-k8s-invalid-es');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const malformedEs = `
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: bad-externalsecret
spec:
  refreshInterval: 1h
`;
    fs.writeFileSync(path.join(tempDir, 'invalid-es.yaml'), malformedEs);

    try {
      const res = validateKubernetesManifests(tempDir);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.message.includes('secretStoreRef'))).toBe(true);
      expect(res.issues.some((i) => i.message.includes('target secret name'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
