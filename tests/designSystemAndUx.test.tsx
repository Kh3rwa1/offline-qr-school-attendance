import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Button,
  TextField,
  PasswordField,
  Select,
  Badge,
  StatusIndicator,
  EmptyState,
  ErrorState,
  PageHeader,
  MetricCard,
  ConfirmationDialog,
} from '../src/components/ui';

describe('Design System & UX Layer Component Suite', () => {
  it('1. Button renders properly with variants, size classes, and touch target minimums', () => {
    const htmlPrimary = renderToString(
      <Button variant="primary" size="md">
        Sign In
      </Button>
    );
    expect(htmlPrimary).toContain('bg-forest-700');
    expect(htmlPrimary).toContain('min-h-[44px]');
    expect(htmlPrimary).toContain('Sign In');

    const htmlDanger = renderToString(
      <Button variant="danger" size="lg">
        Delete Record
      </Button>
    );
    expect(htmlDanger).toContain('bg-danger-600');
    expect(htmlDanger).toContain('min-h-[48px]');

    const htmlLoading = renderToString(
      <Button variant="primary" size="md" isLoading>
        Submitting
      </Button>
    );
    expect(htmlLoading).toContain('animate-spin');
  });

  it('2. TextField renders with label, prefix, helper text, and accessible attributes', () => {
    const html = renderToString(
      <TextField
        label="Mobile Number"
        type="tel"
        prefixText="+91"
        placeholder="90000 00000"
        helperText="Enter 10-digit mobile number"
        required
      />
    );
    expect(html).toContain('Mobile Number');
    expect(html).toContain('+91');
    expect(html).toContain('type="tel"');
    expect(html).toContain('placeholder="90000 00000"');
    expect(html).toContain('Enter 10-digit mobile number');
    expect(html).toContain('required=""');
  });

  it('3. PasswordField renders with password input, toggle button, and accessibility labels', () => {
    const html = renderToString(
      <PasswordField
        label="Account Password"
        placeholder="••••••••••••"
        required
      />
    );
    expect(html).toContain('Account Password');
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Show password"');
  });

  it('4. Select renders accessible label, options, and styled chevron', () => {
    const options = [
      { value: 'en', label: 'English' },
      { value: 'bn', label: 'Bengali' },
    ];
    const html = renderToString(
      <Select label="Preferred Language" options={options} />
    );
    expect(html).toContain('Preferred Language');
    expect(html).toContain('value="en"');
    expect(html).toContain('value="bn"');
    expect(html).toContain('English');
    expect(html).toContain('Bengali');
  });

  it('5. Badge renders semantic tokens with optional dot indicator', () => {
    const htmlSuccess = renderToString(
      <Badge variant="success" dot pulse size="sm">
        Active
      </Badge>
    );
    expect(htmlSuccess).toContain('bg-success-50');
    expect(htmlSuccess).toContain('bg-success-600');
    expect(htmlSuccess).toContain('animate-pulse');
    expect(htmlSuccess).toContain('Active');

    const htmlForest = renderToString(
      <Badge variant="forest" size="md">
        UDISE+ Standard
      </Badge>
    );
    expect(htmlForest).toContain('text-forest-700');
    expect(htmlForest).toContain('UDISE+ Standard');
  });

  it('6. StatusIndicator renders online/offline states and telemetry', () => {
    const htmlOnline = renderToString(
      <StatusIndicator status="online" label="Connected to School Server" />
    );
    expect(htmlOnline).toContain('Connected to School Server');
    expect(htmlOnline).toContain('bg-success-50');

    const htmlOffline = renderToString(
      <StatusIndicator status="offline" count={14} />
    );
    expect(htmlOffline).toContain('14 Pending Sync');
    expect(htmlOffline).toContain('bg-warning-50');
  });

  it('7. EmptyState and ErrorState render clean headings and actions', () => {
    const htmlEmpty = renderToString(
      <EmptyState
        title="No students found"
        description="Try searching with a different roll number or name."
        actionText="Add Student"
      />
    );
    expect(htmlEmpty).toContain('No students found');
    expect(htmlEmpty).toContain('Add Student');

    const htmlError = renderToString(
      <ErrorState
        title="Sync Failed"
        message="Unable to reach the attendance gateway."
        details="Error code: GATEWAY_TIMEOUT_504"
      />
    );
    expect(htmlError).toContain('Sync Failed');
    expect(htmlError).toContain('Unable to reach the attendance gateway.');
    expect(htmlError).toContain('Show technical details');
  });

  it('8. PageHeader renders title, breadcrumbs, badges, and action slots', () => {
    const breadcrumbs = [
      { label: 'School Admin', href: '/app/school-admin' },
      { label: 'Student Roster' },
    ];
    const html = renderToString(
      <PageHeader
        title="Active Student Roster"
        subtitle="Manage enrolled students and class section allocations"
        breadcrumbs={breadcrumbs}
        badges={<Badge variant="forest">Class VIII-A</Badge>}
        actions={<Button variant="primary">New Student</Button>}
      />
    );
    expect(html).toContain('Active Student Roster');
    expect(html).toContain('Manage enrolled students');
    expect(html).toContain('href="/app/school-admin"');
    expect(html).toContain('Class VIII-A');
    expect(html).toContain('New Student');
  });

  it('9. MetricCard renders value, label, and trend indicators', () => {
    const html = renderToString(
      <MetricCard
        label="Today Attendance"
        value={94.5}
        trend={{ value: 3.2, direction: 'up' }}
        subtitle="Above district benchmark"
      />
    );
    expect(html).toContain('Today Attendance');
    expect(html).toContain('Above district benchmark');
    expect(html).toContain('+3.2%');
  });

  it('10. ConfirmationDialog renders intent, title, and buttons when open', () => {
    const html = renderToString(
      <ConfirmationDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Revoke Smartcard?"
        description="This action will permanently invalidate card key proof."
        intent="danger"
        confirmText="Revoke Card"
      />
    );
    expect(html).toContain('Revoke Smartcard?');
    expect(html).toContain('permanently invalidate card key proof');
    expect(html).toContain('Revoke Card');
    expect(html).toContain('Cancel');
  });
});
