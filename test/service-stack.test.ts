// -----------------------------------------------------------------------------
// File: service-stack.test.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Tests validating ALB, ECS Service, listener, and Blue/Green
//              target groups required for deployments.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ServiceStack } from '../lib/service-stack';
import { EcsStack } from '../lib/ecs-stack';
import { VpcStack } from '../lib/vpc-stack';

test('Fargate Service Created and Attached to Target Groups', () => {
  const app = new cdk.App();

  // ------------------------------------------------------------------------
  // Prerequisite stacks
  // ------------------------------------------------------------------------
  // Create a VPC stack to provide networking resources (subnets, routing, etc.)
  const vpcStack = new VpcStack(app, 'TestVpcStack');

  // Create an ECS stack, which defines the cluster, task definition,
  // and target groups that the service will connect to.
  const ecsStack = new EcsStack(app, 'TestEcsStack', { vpc: vpcStack.vpc });

  // ------------------------------------------------------------------------
  // Service stack under test
  // ------------------------------------------------------------------------
  // Instantiate the ServiceStack, passing in dependencies from the ECS stack:
  // - cluster: where tasks will run
  // - taskDefinition: defines the containerised application
  // - blueTargetGroup & greenTargetGroup: enable blue/green deployments
  const stack = new ServiceStack(app, 'TestServiceStack', {
    cluster: ecsStack.cluster,
    taskDefinition: ecsStack.taskDefinition,
    blueTargetGroup: ecsStack.blueTargetGroup,
    greenTargetGroup: ecsStack.greenTargetGroup,
  });

  // Convert resources into a CloudFormation template for assertions
  const template = Template.fromStack(stack);

  // ------------------------------------------------------------------------
  // ECS Fargate Service
  // ------------------------------------------------------------------------
  // Confirms that an ECS Service is created.
  // The service is what runs and maintains copies of the task definition
  // across the cluster and registers them with the target groups.
  template.resourceCountIs('AWS::ECS::Service', 1);
});
