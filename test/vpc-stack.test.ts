import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { VpcStack } from '../lib/vpc-stack';

test('VPC Created with 2 Subnets and NAT Gateway', () => {
  const app = new cdk.App();
  const stack = new VpcStack(app, 'TestVpcStack');
  const template = Template.fromStack(stack);

  // VPC exists
  template.resourceCountIs('AWS::EC2::VPC', 1);

  // Public + Private subnets
  template.resourceCountIs('AWS::EC2::Subnet', 2);

  // NAT Gateway
  template.resourceCountIs('AWS::EC2::NatGateway', 1);
});
