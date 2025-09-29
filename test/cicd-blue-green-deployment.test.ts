import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { VpcStack } from '../lib/vpc-stack';

test('App synthesizes successfully', () => {
  const app = new cdk.App();
  const stack = new VpcStack(app, 'TestVpcStack');
  const template = Template.fromStack(stack);

  expect(template).toBeDefined();
});
