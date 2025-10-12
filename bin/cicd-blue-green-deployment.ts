#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcsStack } from '../lib/ecs-stack';
import { ServiceStack } from '../lib/service-stack';
import { CodeDeployStack } from '../lib/codedeploy-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

// -----------------------------------------------------------------------------
// Step 1: VPC Stack
// -----------------------------------------------------------------------------
const vpcStack = new VpcStack(app, 'VpcStack');

// -----------------------------------------------------------------------------
// Step 2: ECS Cluster + ALB + Target Groups (combined)
// -----------------------------------------------------------------------------
const ecsStack = new EcsStack(app, 'EcsStack', {
  vpc: vpcStack.vpc,
});

// -----------------------------------------------------------------------------
// Step 3: ECS Fargate Service
// -----------------------------------------------------------------------------
const serviceStack = new ServiceStack(app, 'ServiceStack', {
  cluster: ecsStack.cluster,
  taskDefinition: ecsStack.taskDefinition,
  blueTargetGroup: ecsStack.blueTargetGroup,
  greenTargetGroup: ecsStack.greenTargetGroup,
});

// -----------------------------------------------------------------------------
// Step 4: CodeDeploy Stack (handles Blue/Green switching)
// -----------------------------------------------------------------------------
const codeDeployStack = new CodeDeployStack(app, 'CodeDeployStack', {
  service: serviceStack.service,
  cluster: ecsStack.cluster,
  listener: ecsStack.listener,
  blueTargetGroup: ecsStack.blueTargetGroup,
  greenTargetGroup: ecsStack.greenTargetGroup,
});

// -----------------------------------------------------------------------------
// Step 5: CI/CD Pipeline Stack (GitHub Source → Build → Deploy)
// -----------------------------------------------------------------------------
const pipelineStack = new PipelineStack(app, 'PipelineStack', {
  cluster: ecsStack.cluster,
  service: serviceStack.service,
  codedeployApp: codeDeployStack.codedeployApp,
  deploymentGroup: codeDeployStack.deploymentGroup,
  listener: ecsStack.listener,
  blueTargetGroup: ecsStack.blueTargetGroup,
  greenTargetGroup: ecsStack.greenTargetGroup,
  taskDefinition: ecsStack.taskDefinition,
});

// -----------------------------------------------------------------------------
// 🔗 Stack Dependency Ordering
// -----------------------------------------------------------------------------
// Ensures proper creation order to prevent “Target group not associated” errors.
serviceStack.addDependency(vpcStack);
serviceStack.addDependency(ecsStack);
codeDeployStack.addDependency(serviceStack);
pipelineStack.addDependency(codeDeployStack);