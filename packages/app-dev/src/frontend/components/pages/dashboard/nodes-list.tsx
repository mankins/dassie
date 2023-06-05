import { FaPlus, FaWallet } from "react-icons/fa"
import { Link } from "wouter"

import { selectBySeed } from "@dassie/lib-logger"

import { COLORS } from "../../../constants/palette"
import { activeNodesStore } from "../../../remote-signals/active-nodes"
import { useSig } from "../../../utils/remote-reactive"
import { trpc } from "../../../utils/trpc"
import PeeringModeToggle from "./peering-mode-toggle"

const NodesList = () => {
  const sig = useSig()
  const nodes = [...(sig.get(activeNodesStore) ?? new Set())]
  const addRandomNode = trpc.ui.addRandomNode.useMutation()

  return (
    <div className="rounded-lg flex flex-col bg-gray-800 min-h-0 p-4">
      <PeeringModeToggle />
      <h2 className="font-bold text-xl">Nodes</h2>
      <div className="grid grid-cols-2 py-4 gap-x-2 gap-y-3">
        {nodes.map((nodeId) => (
          <div
            key={nodeId}
            className="flex gap-2 items-center bg-slate-700 rounded-full"
          >
            <Link
              href={`/nodes/${nodeId}`}
              className="flex items-center flex-1 pl-3 py-1 hover:bg-slate-600 rounded-full"
            >
              <i
                className="rounded-full h-2 mr-2 w-2 inline-block"
                style={{ background: selectBySeed(COLORS, nodeId) }}
              ></i>
              {nodeId}
            </Link>
            <a
              href={`https://${nodeId}.localhost`}
              className="flex text-gray-400 hover:text-white h-full px-2 items-center rounded-full"
              target="_blank"
              rel="noreferrer"
            >
              <FaWallet />
            </a>
          </div>
        ))}
      </div>
      <div>
        <button
          type="button"
          className="rounded-lg font-medium bg-blue-700 text-white text-sm text-center mr-2 p-2.5 inline-flex items-center dark:bg-blue-600 hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          onClick={() => {
            addRandomNode.mutate({})
          }}
        >
          <FaPlus className="flex-shrink-0 text-lg" />
          <span className="sr-only">Add node</span>
        </button>
      </div>
    </div>
  )
}

export default NodesList
