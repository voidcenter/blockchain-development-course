//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyERC20TokenStandalone {

    string  public name;
    string  public symbol;
    uint    public decimals;
    uint256 public totalSupply;

    mapping (address =>  uint256) public balance;
    mapping (address =>  mapping (address => uint)) public allowance;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    constructor(string memory _name, string memory _symbol, uint256 _decimals, uint256 _totalSupply) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _totalSupply;
        balance[msg.sender] = totalSupply;
    }

    function balanceOf  (address _owner) public view returns (uint256) {
        return balance[_owner];
    }

    function transfer(address _to, uint256 _value) public returns (bool success)  {
        require(balance[msg.sender] >= _value);
        balance[msg.sender] -= _value;
        balance[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        require(balance[msg.sender] >= _value);
        require(allowance[_from][msg.sender] >= _value);
        allowance[_from][msg.sender] -= _value;
        balance[msg.sender] -= _value;
        balance[_to] += _value;
        emit Transfer(_from, _to, _value);
        return true;
    }
}

