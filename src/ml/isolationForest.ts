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
    this.initDefaultBaseline();
  }

  /**
   * Initializes the forest with a standard calibrated baseline distribution of normal AWS IAM behavior
   */
  private initDefaultBaseline(): void {
    const normalSamples: number[][] = [];
    // Generate 256 normal baseline vectors with standard low-variance DevOps profiles
    for (let i = 0; i < 256; i++) {
      normalSamples.push([
        Math.random() * 0.2,            // apiCallCount (low/moderate)
        0,                              // assumeRoleDepth (0 for standard users)
        Math.random() < 0.05 ? 0.1 : 0, // highRiskActionCount (rarely 1)
        Math.random() < 0.03 ? 0.07 : 0,// accessDeniedCount (rarely 1)
        Math.random() * 0.15,           // ipEntropy (single/dual corporate IP)
        Math.random() * 0.1,            // rareApiScore (routine APIs)
        Math.random() * 0.15,           // offHoursScore (standard business hours)
        Math.random() * 0.1,            // novelUserAgentScore (known SDKs)
        0,                              // crossAccount (same account)
        Math.random() < 0.02 ? 0.2 : 0, // errorCodeDiversity (0 or 1 error)
      ]);
    }
    this.fit(normalSamples);
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
   * Predicts anomaly score s in range [0, 1] using standard Liu et al. Isolation Forest equation:
   * s(x, n) = 2^(- E(h(x)) / c(n))
   * Short paths E(h(x)) -> s close to 1 (anomaly)
   * Long paths E(h(x)) -> s close to 0 (normal baseline)
   */
  public score(x: number[]): number {
    if (this.trees.length === 0) {
      this.initDefaultBaseline();
    }

    let totalPathLength = 0;
    for (const tree of this.trees) {
      totalPathLength += this.pathLength(x, tree, 0);
    }
    const avgPathLength = totalPathLength / this.trees.length;
    const cN = IsolationForest.c(this.subSampleSize);
    
    // Liu et al. Isolation Forest formula: s(x, n) = 2^(- E(h(x)) / c(n))
    const rawScore = Math.pow(2, - (avgPathLength / cN));

    // Map raw score [0.35, 0.85] to calibrated [0.0, 1.0] probability interval
    const calibratedScore = (rawScore - 0.40) / 0.45;
    return Math.max(0.02, Math.min(0.99, Number(calibratedScore.toFixed(4))));
  }

  public getTreeCount(): number {
    return this.trees.length;
  }
}
