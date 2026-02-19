// -----------------------------------------------------------------------------
// File: ecs-stack.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Defines the ECS Cluster, ALB, Listener, and Blue/Green Target Groups.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
} from 'aws-cdk-lib';

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class EcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly blueTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly greenTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly listener: elbv2.ApplicationListener;

  // Expose the ALB security group so other stacks can reference it
  public readonly albSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    // ECS Cluster
    // ------------------------------------------------------------------------
    this.cluster = new ecs.Cluster(this, 'AppCluster', {
      vpc: props.vpc,
      containerInsights: true,
    });

    // ------------------------------------------------------------------------
    // Task Definition
    // ------------------------------------------------------------------------
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'AppTaskDef');
    this.taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromRegistry('nginx'),
      memoryLimitMiB: 512,
      cpu: 256,
      portMappings: [{ containerPort: 80 }],
    });

    // ------------------------------------------------------------------------
    // ALB Security Group (Explicit)
    // ------------------------------------------------------------------------
    // Public entry point: allow inbound HTTP from the internet.
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for the public Application Load Balancer',
      allowAllOutbound: true,
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from the internet'
    );

    // ------------------------------------------------------------------------
    // Load Balancer (internet-facing)
    // ------------------------------------------------------------------------
    const lb = new elbv2.ApplicationLoadBalancer(this, 'AppLB', {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: 'BlueGreenLB',
      // Attach SG
      securityGroup: this.albSecurityGroup,
    });

    // ------------------------------------------------------------------------
    // Target Groups (Blue/Green)
    // ------------------------------------------------------------------------
    this.blueTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BlueTG', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        healthyHttpCodes: '200-399',
      },
    });

    this.greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GreenTG', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        healthyHttpCodes: '200-399',
      },
    });

    // ------------------------------------------------------------------------
    // Listener
    // ------------------------------------------------------------------------
    this.listener = lb.addListener('AppListener', {
      port: 80,
      defaultTargetGroups: [this.blueTargetGroup],
      // NOTE: Inbound 80 is open on the ALB SG
    });
  }
}
