param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Command,

  [Parameter(ValueFromRemainingArguments = $true, Position = 1)]
  [string[]] $CommandArguments
)

& $Command @CommandArguments
exit $LASTEXITCODE
