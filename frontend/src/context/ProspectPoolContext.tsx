import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProspectPools, fetchProspectPoolRuns } from "@/lib/api";
import type { ProspectPool, ProspectPoolRun } from "@/types/api";

interface ProspectPoolContextType {
  selectedProspectPoolId: string;
  setSelectedProspectPoolId: (id: string) => void;
  selectedExecutionId: string;
  setSelectedExecutionId: (id: string) => void;
  prospectPools: ProspectPool[];
  executions: ProspectPoolRun[];
  currentExecution: ProspectPoolRun | null;
  isLoading: boolean;
}

const ProspectPoolContext = createContext<ProspectPoolContextType | undefined>(undefined);

export function ProspectPoolProvider({ children }: { children: React.ReactNode }) {
  const [selectedProspectPoolId, setSelectedProspectPoolId] = useState<string>("");
  const [selectedExecutionId, setSelectedExecutionId] = useState<string>("");

  const { data: prospectPools = [], isLoading: isLoadingPools } = useQuery({
    queryKey: ["prospect-pools"],
    queryFn: fetchProspectPools,
  });

  const orderedProspectPools = useMemo(
    () =>
      [...prospectPools].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [prospectPools]
  );

  useEffect(() => {
    if (orderedProspectPools.length > 0 && !selectedProspectPoolId) {
      setSelectedProspectPoolId(orderedProspectPools[0].id);
    }
  }, [orderedProspectPools, selectedProspectPoolId]);

  const { data: executions = [], isLoading: isLoadingExecutions } = useQuery({
    queryKey: ["executions", selectedProspectPoolId],
    queryFn: () => fetchProspectPoolRuns(selectedProspectPoolId),
    enabled: !!selectedProspectPoolId,
    refetchInterval: selectedProspectPoolId ? 5000 : false,
  });

  useEffect(() => {
    if (executions.length > 0) {
      const latest = [...executions].sort((a, b) => 
        new Date(b.execution_date).getTime() - new Date(a.execution_date).getTime()
      )[0];
      setSelectedExecutionId(latest.id);
    } else {
      setSelectedExecutionId("");
    }
  }, [executions]);

  const currentExecution = executions.find(e => e.id === selectedExecutionId) || null;

  return (
    <ProspectPoolContext.Provider value={{
      selectedProspectPoolId,
      setSelectedProspectPoolId,
      selectedExecutionId,
      setSelectedExecutionId,
      prospectPools: orderedProspectPools,
      executions,
      currentExecution,
      isLoading: isLoadingPools || isLoadingExecutions,
    }}>
      {children}
    </ProspectPoolContext.Provider>
  );
}

export function useProspectPool() {
  const context = useContext(ProspectPoolContext);
  if (context === undefined) {
    throw new Error("useProspectPool must be used within a ProspectPoolProvider");
  }
  return context;
}
