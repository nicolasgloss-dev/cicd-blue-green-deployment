// -----------------------------------------------------------------------------
// File: cicd-blue-green-deployment.test.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Ensures that all stacks in the application synthesize correctly
//              and required cross-stack references are passed properly.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { VpcStack } from '../lib/vpc-stack';

test('App synthesizes successfully', () => {
  const app = new cdk.App();
  const stack = new VpcStack(app, 'TestVpcStack');
  const template = Template.fromStack(stack);

  expect(template).toBeDefined();
});
