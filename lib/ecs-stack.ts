import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
} from 'aws-cdk-lib';

// Props allow this stack to receive a VPC from another stack.
// This makes the architecture modular and reusable.
export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class EcsStack extends cdk.Stack {
  // Expose these resources so they can be used in other stacks (such as CodeDeploy or Pipeline).
  public readonly cluster: ecs.Cluster;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly blueTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly greenTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly listener: elbv2.ApplicationListener;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    // ECS Cluster
    // ------------------------------------------------------------------------
    // A cluster groups ECS resources together. It is deployed into the provided VPC.
    // containerInsightsV2 enables improved CloudWatch metrics for monitoring
    // (CPU, memory, networking), which is important for troubleshooting and cost awareness.
    this.cluster = new ecs.Cluster(this, 'AppCluster', {
      vpc: props.vpc,
      containerInsightsV2: true,
    });

    // ------------------------------------------------------------------------
    // Task Definition
    // ------------------------------------------------------------------------
    // A Fargate Task Definition specifies how containers should run in ECS.
    // This example uses a lightweight NGINX container, which is commonly used
    // as a simple web server for testing and demonstration purposes.
    // The configuration is minimal and suitable for blue/green deployment testing.
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'AppTaskDef');
    this.taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromRegistry('nginx'), // Public container image
      memoryLimitMiB: 512, // 512MB RAM allocated
      cpu: 256,            // 0.25 vCPU allocated
      portMappings: [{ containerPort: 80 }], // Application listens on port 80
    });

    // ------------------------------------------------------------------------
    // Load Balancer
    // ------------------------------------------------------------------------
    // An internet-facing Application Load Balancer to distribute incoming traffic.
    // This is essential for blue/green deployments because it can shift traffic
    // between different target groups (blue = current, green = new).
    const lb = new elbv2.ApplicationLoadBalancer(this, 'AppLB', {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: 'BlueGreenLB',
    });

    // ------------------------------------------------------------------------
    // Target Groups (Blue/Green)
    // ------------------------------------------------------------------------
    // Blue Target Group = currently active version
    this.blueTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BlueTG', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: elbv2.TargetType.IP, // Targets are ECS tasks (IP addresses)
    });

    // Green Target Group = new version to be tested/deployed
    this.greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GreenTG', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: elbv2.TargetType.IP,
    });

    // ------------------------------------------------------------------------
    // Listener
    // ------------------------------------------------------------------------
    // The listener accepts incoming traffic on port 80 and routes to a target group.
    // By default it points to Blue (active). During deployments, CodeDeploy or a CI/CD
    // pipeline can shift traffic to Green safely, enabling zero-downtime releases.
    this.listener = lb.addListener('AppListener', {
      port: 80,
      defaultTargetGroups: [this.blueTargetGroup],
    });
  }
}
