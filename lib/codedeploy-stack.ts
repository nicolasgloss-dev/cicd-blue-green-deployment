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
      service: props.service,
      blueGreenDeploymentConfig: {
        // Listener controls routing of live traffic
        listener: props.listener,

        // Blue = active target group, Green = new version under test
        blueTargetGroup: props.blueTargetGroup,
        greenTargetGroup: props.greenTargetGroup,

        // Time to wait before terminating old tasks after successful switch
        terminationWaitTime: Duration.minutes(1),
      },

      // Deployment strategy:
      // ALL_AT_ONCE → shifts traffic immediately.
      // Other options (linear, canary) are available for safer rollouts.
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,

      // Link deployment group to the CodeDeploy application
      application: this.codedeployApp,
    });
  }
}
