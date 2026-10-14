"""Read-only mainnet deployment estimate; never signs or broadcasts.

Run forge build, then python3 estimate.py from this directory.
This estimates the experimental contract, not a production release.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
RPC = "https://rpc.blockdaemon.mainnet.arc.io"


def rpc(method, params):
    request = Request(RPC, data=json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": method, "params": params
    }).encode(), headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=20) as response:
        result = json.load(response)
    if "error" in result:
        raise RuntimeError(result["error"])
    return result["result"]


parser = argparse.ArgumentParser()
parser.add_argument("--contract", choices=["ProjectPayments", "TeamPay"], default="ProjectPayments")
contract_name = parser.parse_args().contract
bytecode = json.loads((ROOT / f"out/{contract_name}.sol/{contract_name}.json").read_text())["bytecode"]["object"]
chain_id = int(rpc("eth_chainId", []), 16)
if chain_id != 5042:
    raise RuntimeError(f"Unexpected chain: {chain_id}")
block = rpc("eth_getBlockByNumber", ["latest", False])
now = datetime.datetime.now(datetime.timezone.utc)
block_time = datetime.datetime.fromtimestamp(int(block["timestamp"], 16), datetime.timezone.utc)
if abs((now - block_time).total_seconds()) > 120:
    raise RuntimeError("RPC returned a stale block; do not quote a live fee")
gas = int(rpc("eth_estimateGas", [{"data": bytecode}]), 16)
price = int(rpc("eth_gasPrice", []), 16)
report = {
    "prototype_only": True,
    "contract": contract_name,
    "queried_at_utc": now.isoformat(),
    "rpc": RPC,
    "chain_id": chain_id,
    "block_number": int(block["number"], 16),
    "block_time_utc": block_time.isoformat(),
    "creation_bytecode_sha256": hashlib.sha256(bytes.fromhex(bytecode.removeprefix("0x"))).hexdigest(),
    "deployment_gas": gas,
    "gas_price_gwei": price / 1e9,
    "estimated_fee_usdc": gas * price / 1e18,
    "fee_with_2x_price_and_20_percent_gas_buffer_usdc": gas * price * 2.4 / 1e18,
    "excludes": ["project creation", "payments and withdrawals", "demo principal", "bridging", "hosting"],
    "limitations": ["Unaudited feasibility prototype", "Local tests use standard EVM, not Arc runtime", "No transaction sent"],
}
(ROOT / ("cost-estimate.json" if contract_name == "ProjectPayments" else "teampay-cost-estimate.json")).write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
