// -----------------------------------------------------------------------------
// File: service-stack.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Creates the ECS Fargate Service and attaches it to the Blue TG.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface ServiceStackProps extends cdk.StackProps {
  vpc: ec2.Vpc; // needed to create the service security group
  albSecurityGroup: ec2.ISecurityGroup; // used for least-privilege ingress
  cluster: ecs.Cluster;
  taskDefinition: ecs.FargateTaskDefinition;
  blueTargetGroup: elbv2.ApplicationTargetGroup;
  greenTargetGroup: elbv2.ApplicationTargetGroup;
}

export class ServiceStack extends cdk.Stack {
  public readonly service: ecs.FargateService;

  // (Optional) export SG for troubleshooting / documentation
  public readonly serviceSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    // Service Security Group (Explicit)
    // ------------------------------------------------------------------------
    // Least privilege: only ALB can reach the service on port 80.
    this.serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for ECS service tasks (inbound only from ALB)',
      allowAllOutbound: true,
    });

    this.serviceSecurityGroup.addIngressRule(
      props.albSecurityGroup,
      ec2.Port.tcp(80),
      'Allow HTTP from ALB only'
    );

    // ------------------------------------------------------------------------
    // Fargate Service (Private Subnets)
    // ------------------------------------------------------------------------
    this.service = new ecs.FargateService(this, 'AppService', {
      cluster: props.cluster,
      taskDefinition: props.taskDefinition,
      desiredCount: 1,

      // Move tasks into private subnets
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },

      // No public IPs on tasks
      assignPublicIp: false,

      // Use SG
      securityGroups: [this.serviceSecurityGroup],

      // Required for CodeDeploy blue/green
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
    });

    // ------------------------------------------------------------------------
    // Register only with Blue Target Group
    // ------------------------------------------------------------------------
    props.blueTargetGroup.addTarget(this.service);

    // Do not attach Green TG here
    // props.greenTargetGroup.addTarget(this.service);
  }
}
