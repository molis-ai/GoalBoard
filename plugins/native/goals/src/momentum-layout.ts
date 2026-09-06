import type { GoalMomentumGoalInput } from "./momentum-model.js";

export function compareGoal(left: GoalMomentumGoalInput, right: GoalMomentumGoalInput): number {
  return left.title.localeCompare(right.title) || left.goal_id.localeCompare(right.goal_id);
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

export function insertSorted(queue: string[], value: string, byId: ReadonlyMap<string, GoalMomentumGoalInput>): void {
  queue.push(value);
  queue.sort((left, right) => compareGoal(byId.get(left)!, byId.get(right)!));
}

export function assignDependencyRows(
  membersByLevel: Map<number, GoalMomentumGoalInput[]>,
  providers: ReadonlyMap<string, readonly string[]>,
  consumers: ReadonlyMap<string, readonly string[]>,
): Map<string, number> {
  const levels = [...membersByLevel.keys()].sort((left, right) => left - right);
  const rowCount = Math.max(1, ...[...membersByLevel.values()].map((members) => members.length));
  const rowByGoal = new Map<string, number>();
  for (const members of membersByLevel.values()) {
    const denominator = Math.max(1, members.length - 1);
    members.forEach((member, index) => {
      rowByGoal.set(
        member.goal_id,
        members.length === 1 ? 0 : Math.round(index / denominator * (rowCount - 1)),
      );
    });
  }
  if (levels.length < 2 || rowCount < 2) return rowByGoal;
  const memberIds = new Set(
    [...membersByLevel.values()].flatMap((members) => members.map((member) => member.goal_id)),
  );

  const nearestUniqueRows = (
    members: readonly GoalMomentumGoalInput[],
    targetFor: (goalId: string) => number,
  ): Map<string, number> => {
    const ordered = [...members].sort((left, right) =>
      targetFor(left.goal_id) - targetFor(right.goal_id) || compareGoal(left, right)
    );
    const memberCount = ordered.length;
    const costs: number[][] = Array.from({ length: memberCount }, () =>
      Array.from({ length: rowCount }, () => Number.POSITIVE_INFINITY)
    );
    const previous: number[][] = Array.from({ length: memberCount }, () =>
      Array.from({ length: rowCount }, () => -1)
    );
    for (let row = 0; row <= rowCount - memberCount; row += 1) {
      costs[0]![row] = Math.abs(row - targetFor(ordered[0]!.goal_id));
    }
    for (let index = 1; index < memberCount; index += 1) {
      let bestCost = Number.POSITIVE_INFINITY;
      let bestRow = -1;
      for (let row = index; row < rowCount; row += 1) {
        const candidateRow = row - 1;
        const candidateCost = costs[index - 1]![candidateRow]!;
        if (candidateCost < bestCost) {
          bestCost = candidateCost;
          bestRow = candidateRow;
        }
        if (row > rowCount - (memberCount - index)) continue;
        costs[index]![row] = bestCost + Math.abs(row - targetFor(ordered[index]!.goal_id));
        previous[index]![row] = bestRow;
      }
    }
    let finalRow = 0;
    let finalCost = Number.POSITIVE_INFINITY;
    for (let row = memberCount - 1; row < rowCount; row += 1) {
      if (costs[memberCount - 1]![row]! < finalCost) {
        finalCost = costs[memberCount - 1]![row]!;
        finalRow = row;
      }
    }
    const assigned = new Map<string, number>();
    for (let index = memberCount - 1; index >= 0; index -= 1) {
      assigned.set(ordered[index]!.goal_id, finalRow);
      finalRow = previous[index]![finalRow] ?? -1;
    }
    return assigned;
  };

  const reorder = (
    level: number,
    neighbors: ReadonlyMap<string, readonly string[]>,
  ) => {
    const members = membersByLevel.get(level);
    if (!members?.length) return;
    const barycenter = (goalId: string): number => {
      const positions = (neighbors.get(goalId) ?? [])
        .filter((neighborId) => memberIds.has(neighborId))
        .map((neighborId) => rowByGoal.get(neighborId))
        .filter((value): value is number => value !== undefined);
      if (!positions.length) return rowByGoal.get(goalId) ?? 0;
      return positions.reduce((sum, value) => sum + value, 0) / positions.length;
    };
    for (const [goalId, row] of nearestUniqueRows(members, barycenter)) rowByGoal.set(goalId, row);
  };

  // Alternating provider and consumer sweeps share one absolute row grid across
  // every level. Sparse levels keep intentional slots instead of being packed
  // back to row zero, so the row coordinate used by a node also describes the
  // dependency lines that enter and leave it.
  for (let pass = 0; pass < 6; pass += 1) {
    levels.slice(1).forEach((level) => reorder(level, providers));
    [...levels].reverse().slice(1).forEach((level) => reorder(level, consumers));
  }
  return rowByGoal;
}
