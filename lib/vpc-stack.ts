// -----------------------------------------------------------------------------
// File: vpc-stack.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Creates a secure VPC with public and private subnets for ECS
//              and supporting services, forming the network foundation.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// -----------------------------------------------------------------------------
// VpcStack
// -----------------------------------------------------------------------------
// Creates a Virtual Private Cloud (VPC) with two Availability Zones,
// public and private subnets, and a NAT gateway. This provides the
// networking foundation for all application resources.
// -----------------------------------------------------------------------------
export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    // VPC Configuration
    // ------------------------------------------------------------------------
    // - maxAzs: 2 - spreads resources across two Availability Zones
    //   for high availability and fault tolerance.
    // - natGateways: 1 - allows outbound internet access for private subnets
    //   while keeping instances isolated from direct inbound traffic.
    // - subnetConfiguration: defines both public and private subnets.
    this.vpc = new ec2.Vpc(this, 'AppVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          // Public subnet: resources here can have public IPs
          // and receive direct internet traffic.
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          // Private subnet: resources here do not have public IPs.
          // They route outbound traffic through the NAT Gateway.
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });
  }
}
