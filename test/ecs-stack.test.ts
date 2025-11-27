// -----------------------------------------------------------------------------
// File: ecs-stack.test.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Tests validating ECS Cluster, Task Definition, and associated
//              IAM permissions created by the ECS stack.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsStack } from '../lib/ecs-stack';
import { VpcStack } from '../lib/vpc-stack';

test('ECS Cluster, Task Definition, ALB, Listener and Target Groups Created', () => {
  const app = new cdk.App();

  // Reuse the VPC from VpcStack so the ECS stack has networking available
  const vpcStack = new VpcStack(app, 'TestVpcStack');

  // Deploy the ECS stack into the test app with the VPC
  const stack = new EcsStack(app, 'TestEcsStack', { vpc: vpcStack.vpc });

  // Convert stack into a CloudFormation template for assertions
  const template = Template.fromStack(stack);

  // ------------------------------------------------------------------------
  // ECS Cluster
  // ------------------------------------------------------------------------
  // Ensures a cluster is created. The cluster should have container insights
  // enabled for monitoring in production, but here we just check resource count.
  template.resourceCountIs('AWS::ECS::Cluster', 1);

  // ------------------------------------------------------------------------
  // Fargate Task Definition
  // ------------------------------------------------------------------------
  // Confirms that a single task definition is created to run containers.
  template.resourceCountIs('AWS::ECS::TaskDefinition', 1);

  // The task definition must expose port 80 so that the load balancer
  // and target groups can route traffic correctly.
  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: [
      {
        PortMappings: [{ ContainerPort: 80 }],
      },
    ],
  });

  // ------------------------------------------------------------------------
  // Application Load Balancer + Listener
  // ------------------------------------------------------------------------
  // Confirms an internet-facing load balancer is provisioned along with a listener.
  template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
    Scheme: 'internet-facing',
  });
  template.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);

  // ------------------------------------------------------------------------
  // Blue/Green Target Groups
  // ------------------------------------------------------------------------
  // Two target groups must exist to support blue/green deployments:
  // Blue = active, Green = new version under test.
  template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 2);
});
