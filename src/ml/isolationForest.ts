/**
 * Isolation Forest Algorithm for AWS CloudTrail Anomaly Detection
 * Builds an ensemble of Isolation Trees over the 10-dimensional feature space.
 * Anomalies are isolated closer to the root (shorter path lengths).
 */

interface IsolationTreeNode {
  splitFeature?: number;
  splitValue?: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
  size: number;
  isLeaf: boolean;
}

export class IsolationForest {
  private trees: IsolationTreeNode[] = [];
  private numTrees: number;
  private subSampleSize: number;
  private maxDepth: number;
  private numFeatures: number = 10;
  private trained: boolean = false;
  private nTrainSamples: number = 0;

  constructor(numTrees: number = 60, subSampleSize: number = 128) {
    this.numTrees = numTrees;
    this.subSampleSize = subSampleSize;
    this.maxDepth = Math.ceil(Math.log2(Math.max(subSampleSize, 2)));
  }

  // Euler-Mascheroni constant approx for c(n) average path length
  private static c(n: number): number {
    if (n <= 1) return 1;
    if (n === 2) return 1;
    const eulerGamma = 0.5772156649;
    return 2.0 * (Math.log(n - 1) + eulerGamma) - (2.0 * (n - 1)) / n;
  }

  /**
   * Fits the Isolation Forest on normalized feature vectors (array of number[10])
   */
  public fit(X: number[][]): void {
    this.trees = [];
    this.nTrainSamples = X.length;
    if (X.length === 0) return;

    for (let i = 0; i < this.numTrees; i++) {
      // Subsample data
      const sampleSize = Math.min(this.subSampleSize, X.length);
      const subSample: number[][] = [];
      for (let j = 0; j < sampleSize; j++) {
        const randIdx = Math.floor(Math.random() * X.length);
        subSample.push(X[randIdx]);
      }

      const tree = this.buildITree(subSample, 0, this.maxDepth);
      this.trees.push(tree);
    }
    this.trained = true;
  }

  private buildITree(X: number[][], currentDepth: number, maxDepth: number): IsolationTreeNode {
    if (currentDepth >= maxDepth || X.length <= 1) {
      return { size: X.length, isLeaf: true };
    }

    // Pick random feature
    const splitFeature = Math.floor(Math.random() * this.numFeatures);
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const row of X) {
      const val = row[splitFeature] || 0;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    if (minVal === maxVal) {
      return { size: X.length, isLeaf: true };
    }

    const splitValue = minVal + Math.random() * (maxVal - minVal);
    const leftData: number[][] = [];
    const rightData: number[][] = [];

    for (const row of X) {
      if ((row[splitFeature] || 0) < splitValue) {
        leftData.push(row);
      } else {
        rightData.push(row);
      }
    }

    return {
      splitFeature,
      splitValue,
      left: this.buildITree(leftData, currentDepth + 1, maxDepth),
      right: this.buildITree(rightData, currentDepth + 1, maxDepth),
      size: X.length,
      isLeaf: false,
    };
  }

  /**
   * Path length h(x) of point x in an iTree
   */
  private pathLength(x: number[], node: IsolationTreeNode, currentDepth: number): number {
    if (node.isLeaf) {
      return currentDepth + IsolationForest.c(node.size);
    }
    const featureIdx = node.splitFeature!;
    const val = x[featureIdx] || 0;
    if (val < node.splitValue!) {
      return this.pathLength(x, node.left!, currentDepth + 1);
    } else {
      return this.pathLength(x, node.right!, currentDepth + 1);
    }
  }

  /**
   * Predicts anomaly score s in range [0, 1]. Higher value means higher probability of being anomalous.
   */
  public score(x: number[]): number {
    if (!this.trained || this.trees.length === 0) {
      // Fallback heuristics based on feature vector values if untrained
      return this.heuristicScore(x);
    }

    let totalPathLength = 0;
    for (const tree of this.trees) {
      totalPathLength += this.pathLength(x, tree, 0);
    }
    const avgPathLength = totalPathLength / this.trees.length;
    const cN = IsolationForest.c(this.subSampleSize);
    
    // Anomaly score formula: s(x, n) = 2^(- avg_h / c(n))
    const score = Math.pow(2, - (avgPathLength / cN));

    // Combine with specific domain weights (e.g. role chaining & sensitive actions)
    const domainMultiplier = 0.7 * score + 0.3 * this.heuristicScore(x);
    return Math.max(0.0, Math.min(1.0, domainMultiplier));
  }

  private heuristicScore(x: number[]): number {
    // x indices:
    // 0: apiCallCount, 1: assumeRoleDepth, 2: highRiskActionCount, 3: accessDeniedCount,
    // 4: ipEntropy, 5: rareApiScore, 6: offHoursScore, 7: novelUserAgentScore, 8: crossAccount, 9: errorCodeDiversity
    const weights = [0.08, 0.22, 0.25, 0.12, 0.06, 0.12, 0.04, 0.05, 0.04, 0.02];
    let score = 0;
    for (let i = 0; i < weights.length; i++) {
      score += (x[i] || 0) * weights[i];
    }
    return Math.min(1.0, score * 1.5);
  }

  public getTreeCount(): number {
    return this.trees.length;
  }
}
