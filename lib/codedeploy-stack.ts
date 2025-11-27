// -----------------------------------------------------------------------------
// File: codedeploy-stack.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Sets up the ECS CodeDeploy Application and Deployment Group to
//              orchestrate Blue/Green deployments with automatic traffic shifting.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Duration } from 'aws-cdk-lib';

// -----------------------------------------------------------------------------
// CodeDeployStackProps
// -----------------------------------------------------------------------------
// Props define dependencies that must be passed into this stack:
// - cluster: ECS Cluster hosting the service
// - service: Fargate Service to be deployed with CodeDeploy
// - listener: ALB listener that routes traffic between blue and green
// - blueTargetGroup / greenTargetGroup: target groups used for deployment
// -----------------------------------------------------------------------------
export interface CodeDeployStackProps extends cdk.StackProps {
  cluster: ecs.Cluster;
  service: ecs.FargateService;
  listener: elbv2.ApplicationListener;
  blueTargetGroup: elbv2.ApplicationTargetGroup;
  greenTargetGroup: elbv2.ApplicationTargetGroup;
}

// -----------------------------------------------------------------------------
// CodeDeployStack
// -----------------------------------------------------------------------------
// Creates an ECS CodeDeploy application and deployment group.
// This enables blue/green deployments with traffic shifting,
// safe rollback, and configurable termination wait times.
// -----------------------------------------------------------------------------
// Note: The Green Target Group is dynamically attached during deployment.
// The ECS service itself only registers with the Blue TG to avoid
// creation-time validation errors.
// -----------------------------------------------------------------------------
export class CodeDeployStack extends cdk.Stack {
  public readonly codedeployApp: codedeploy.EcsApplication;
  public readonly deploymentGroup: codedeploy.EcsDeploymentGroup;

  constructor(scope: Construct, id: string, props: CodeDeployStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    // CodeDeploy Application
    // ------------------------------------------------------------------------
    // Logical container for ECS deployment groups.
    // Represents the application being deployed.
    this.codedeployApp = new codedeploy.EcsApplication(this, 'CodeDeployApp', {
      applicationName: 'MyEcsApp',
    });

    // ------------------------------------------------------------------------
    // ECS Deployment Group
    // ------------------------------------------------------------------------
    // Connects the ECS service to CodeDeploy.
    // Configures how traffic is shifted between blue and green versions.
    this.deploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'EcsDeploymentGroup', {
      // Link to CodeDeploy application
      application: this.codedeployApp,

      // ECS service being deployed
      service: props.service,

      // ----------------------------------------------------------------------
      // Blue/Green Configuration
      // ----------------------------------------------------------------------
      blueGreenDeploymentConfig: {
        // ALB listener that routes live traffic
        listener: props.listener,
        // Define Blue (active) and Green (new) target groups
        blueTargetGroup: props.blueTargetGroup,
        greenTargetGroup: props.greenTargetGroup,
        // Keeps old tasks alive briefly for connection draining and rollback
        terminationWaitTime: Duration.minutes(1),
      },

      // ----------------------------------------------------------------------
      // Deployment Strategy
      // ----------------------------------------------------------------------
      // ALL_AT_ONCE → shifts 100% of traffic immediately after verification.
      // Alternate strategies (canary/linear) can be used for gradual rollouts.
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,

      // ----------------------------------------------------------------------
      // Rollback Settings
      // ----------------------------------------------------------------------
      // Enables safer blue/green rollouts in demos or production environments.
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
      },
    });

    // ------------------------------------------------------------------------
    // End of CodeDeployStack
    // ------------------------------------------------------------------------
    // ECS Blue/Green deployments are now fully configured.
    // CodeDeploy handles traffic shifting, rollback, and lifecycle management.
  }
}
