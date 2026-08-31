cd /home/administrator/workspace/agentmemory && CONTENT=$(cat <<'EOF'
审计思维框架（完整方法论见 evm-audit-master 技能）：
1. 外部可操控性：可操控输入 × 决定钱的计算；判据=读外部结果是否有经济后果，不是有没有读外部
2. 逆向构造：门控=待伪造前提，反推需先污染什么；正面受阻走侧面（链下/时序/激励）
3. 两阶段：单点（CEI/重入/溢出）→组合（全局不变量）；组合漏洞必须给逐步攻击序列
4. 四问：谁调用/传什么/改什么/影响什么钱
5. 获利门控：不能提取资金/操纵价格/套利/拿赏金 → 跳过
6. 判据链条：可操控→影响钱→获利路径→成本可行→才是漏洞
专项细节：evm-audit-erc4626 / evm-audit-defi-amm / evm-audit-oracles
EOF
)
node amc.js slots set vulnerability-hunting-mindset "$(printf '%s' "$CONTENT")" --scope=global
