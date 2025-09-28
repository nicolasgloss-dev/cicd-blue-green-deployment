#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcsStack } from '../lib/ecs-stack';
import { ServiceStack } from '../lib/service-stack';
import { CodeDeployStack } from '../lib/codedeploy-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

// Step 1: VPC Stack
const vpcStack = new VpcStack(app, 'VpcStack');

// Step 2: ECS Cluster Stack
const ecsStack = new EcsStack(app, 'EcsStack', {
  vpc: vpcStack.vpc,
});

// Step 3: Service Stack
const serviceStack = new ServiceStack(app, 'ServiceStack', {
  cluster: ecsStack.cluster,
  taskDefinition: ecsStack.taskDefinition,
  blueTargetGroup: ecsStack.blueTargetGroup,
  greenTargetGroup: ecsStack.greenTargetGroup,
});

// Step 4: CodeDeploy Stack
const codeDeployStack = new CodeDeployStack(app, 'CodeDeployStack', {
  service: serviceStack.service,
  cluster: ecsStack.cluster,
  listener: ecsStack.listener,
  blueTargetGroup: ecsStack.blueTargetGroup,
  greenTargetGroup: ecsStack.greenTargetGroup,
});

// Step 5: Pipeline Stack (GitHub as Source)
new PipelineStack(app, 'PipelineStack', {
  cluster: ecsStack.cluster,
  service: serviceStack.service,
  codedeployApp: codeDeployStack.codedeployApp,
  deploymentGroup: codeDeployStack.deploymentGroup,
  listener: ecsStack.listener,
  blueTargetGroup: ecsStack.blueTargetGroup,
  greenTargetGroup: ecsStack.greenTargetGroup,
  taskDefinition: ecsStack.taskDefinition,
});
