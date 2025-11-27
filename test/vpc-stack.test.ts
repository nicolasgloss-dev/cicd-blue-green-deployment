// -----------------------------------------------------------------------------
// File: vpc-stack.test.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Tests ensuring that the VPC stack creates expected subnets,
//              route tables, and foundational networking resources.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { VpcStack } from '../lib/vpc-stack';

test('VPC Created with 4 Subnets and NAT Gateway', () => {
  const app = new cdk.App();

  // Instantiate the VPC stack in the test app
  const stack = new VpcStack(app, 'TestVpcStack');

  // Convert stack resources into a CloudFormation template for assertions
  const template = Template.fromStack(stack);

  // ------------------------------------------------------------------------
  // VPC
  // ------------------------------------------------------------------------
  // Ensures that one VPC resource is created.
  // The VPC provides isolated networking for all other stacks.
  template.resourceCountIs('AWS::EC2::VPC', 1);

  // ------------------------------------------------------------------------
  // Subnets
  // ------------------------------------------------------------------------
  // Confirms that four subnets are created.
  // Typically this means two public and two private subnets for high availability.
  template.resourceCountIs('AWS::EC2::Subnet', 4);

  // ------------------------------------------------------------------------
  // NAT Gateway
  // ------------------------------------------------------------------------
  // Ensures a NAT Gateway is provisioned.
  // This allows private subnets to access the internet (for software updates)
  // without exposing resources directly.
  template.resourceCountIs('AWS::EC2::NatGateway', 1);
});
