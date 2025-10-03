import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

// -----------------------------------------------------------------------------
// ServiceStackProps
// -----------------------------------------------------------------------------
// Props define dependencies that must be passed into this stack:
// - cluster: the ECS Cluster where the service will run
// - taskDefinition: the containerised application definition
// - blueTargetGroup / greenTargetGroup: target groups used for blue/green
//   deployments, allowing zero-downtime releases.
// -----------------------------------------------------------------------------
export interface ServiceStackProps extends cdk.StackProps {
  cluster: ecs.Cluster;
  taskDefinition: ecs.FargateTaskDefinition;
  blueTargetGroup: elbv2.ApplicationTargetGroup;
  greenTargetGroup: elbv2.ApplicationTargetGroup;
}

// -----------------------------------------------------------------------------
// ServiceStack
// -----------------------------------------------------------------------------
// Creates a Fargate Service that runs tasks based on the provided task definition.
// The service is registered with both blue and green target groups so that
// traffic can be shifted during deployments.
// -----------------------------------------------------------------------------
export class ServiceStack extends cdk.Stack {
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    // Fargate Service
    // ------------------------------------------------------------------------
    // - desiredCount: 1 → runs a single copy of the task definition
    //   (suitable for a demo or portfolio project).
    // - assignPublicIp: true → assigns a public IP so the service
    //   can be reached directly if needed (for testing).
    //   In production this would typically be false, with traffic
    //   routed only through the load balancer.
    // - deploymentController: REQUIRED for CodeDeploy blue/green
    //   This tells ECS that deployments will be managed by CodeDeploy,
    //   not the default rolling update mechanism.
    this.service = new ecs.FargateService(this, 'AppService', {
      cluster: props.cluster,
      taskDefinition: props.taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
    });

    // ------------------------------------------------------------------------
    // Target Group Registration
    // ------------------------------------------------------------------------
    // Register the service with both blue and green target groups.
    // CodeDeploy or a CI/CD pipeline can then direct traffic between them
    // during a deployment, enabling zero-downtime application updates.
    props.blueTargetGroup.addTarget(this.service);
    props.greenTargetGroup.addTarget(this.service);
  }
}
