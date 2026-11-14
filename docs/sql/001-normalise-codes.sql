update rules set code = upper(code);
update facts set code = upper(code);
update findings set rule
_
code = upper(rule
_
code) where rule
_
code is not null;