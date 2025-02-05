import { Amount } from "../../../components/amount/amount"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table"
import { USD_SPECIFICATION } from "../../../constants/currency"
import { trpc } from "../../../utils/trpc"

export function Ledger() {
  const ledger = trpc.debug.getLedger.useQuery().data ?? []

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Account</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="text-right">
              Credits<div className="opacity-70">+ Pending</div>
            </TableHead>
            <TableHead className="text-right">
              Debits<div className="opacity-70">+ Pending</div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ledger
            .sort((a, b) => (a.path > b.path ? 1 : -1))
            .map(
              ({
                path,
                creditsPending,
                debitsPending,
                creditsPosted,
                debitsPosted,
              }) => {
                const balance = creditsPosted - debitsPosted - debitsPending
                return (
                  <TableRow key={path}>
                    <TableCell className="font-medium">{path}</TableCell>
                    <TableCell className="text-right">
                      <Amount value={balance} currency={USD_SPECIFICATION} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Amount
                        value={creditsPosted}
                        currency={USD_SPECIFICATION}
                        className="flex justify-end"
                      />
                      <div className="opacity-70">
                        +{" "}
                        <Amount
                          value={creditsPending}
                          currency={USD_SPECIFICATION}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Amount
                        value={debitsPosted}
                        currency={USD_SPECIFICATION}
                        className="flex justify-end"
                      />
                      <div className="opacity-70">
                        +{" "}
                        <Amount
                          value={debitsPending}
                          currency={USD_SPECIFICATION}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              },
            )}
        </TableBody>
      </Table>
    </div>
  )
}
